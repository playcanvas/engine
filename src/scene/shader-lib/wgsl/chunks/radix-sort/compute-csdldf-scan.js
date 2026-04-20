// Chained Scan with Decoupled Lookback + Decoupled Fallback (CSDLDF)
//
// Single-pass GPU prefix scan that works on hardware without forward-thread
// progress guarantees (e.g. Apple Silicon), by falling back to a self-reduction
// of the blocked partition after a bounded spin.
//
// Algorithm:      Levien, Owens, Smith - "Decoupled Fallback: A Portable
//                 Single-Pass GPU Scan"
// Reference WGSL: https://github.com/b0nes164/GPUPrefixSums
//                 (Thomas Smith, Copyright (c) 2024, MIT License)
// Original file:  GPUPrefixSumsWebGPUapis/SharedShaders/csdldf.wgsl
//                 (SPDX-License-Identifier: MIT)
//
// This adaptation:
//  - Drops the `misc` binding (it was only used by the reference as an
//    external spin counter for benchmarking; unused by the algorithm itself).
//  - Binds `scan_in` and `scan_out` to the same storage buffer (in-place).
//    Safe because each thread reads its full partition slice into registers
//    before the first write, and partitions are disjoint across workgroups.
//  - Adds an optional EXCLUSIVE_SCAN mode that caches the pre-scan vec4 per
//    iteration and subtracts it on the final store. Default is inclusive
//    (matching the reference).
//  - Preserves `workgroupUniformLoad(&wg_broadcast)` and
//    `workgroupUniformLoad(&wg_lock)` verbatim - these are what allow the
//    Tint-on-Metal uniformity analysis to accept the lookback/fallback loop.

export const csdldfScanSource = /* wgsl */`

@group(0) @binding(0) var<storage, read_write> items: array<vec4<u32>>;
@group(0) @binding(1) var<storage, read_write> scan_bump: atomic<u32>;
@group(0) @binding(2) var<storage, read_write> reduction: array<atomic<u32>>;

struct CsdldfScanUniforms {
    size: u32,
    vecSize: u32,
    threadBlocks: u32
};
@group(0) @binding(3) var<uniform> uniforms: CsdldfScanUniforms;

const BLOCK_DIM: u32 = 256u;
const MIN_SUBGROUP_SIZE: u32 = 4u;
const MAX_REDUCE_SIZE: u32 = BLOCK_DIM / MIN_SUBGROUP_SIZE;

const VEC4_SPT: u32 = 4u;
const VEC_PART_SIZE: u32 = BLOCK_DIM * VEC4_SPT;

const FLAG_NOT_READY: u32 = 0u;
const FLAG_REDUCTION: u32 = 1u;
const FLAG_INCLUSIVE: u32 = 2u;
const FLAG_MASK: u32 = 3u;

const MAX_SPIN_COUNT: u32 = 4u;
const LOCKED: u32 = 1u;
const UNLOCKED: u32 = 0u;

var<workgroup> wg_lock: u32;
var<workgroup> wg_broadcast: u32;
var<workgroup> wg_reduce: array<u32, MAX_REDUCE_SIZE>;
var<workgroup> wg_fallback: array<u32, MAX_REDUCE_SIZE>;

@compute @workgroup_size(BLOCK_DIM, 1, 1)
fn main(
    @builtin(local_invocation_id) threadid: vec3<u32>,
    @builtin(subgroup_invocation_id) laneid: u32,
    @builtin(subgroup_size) lane_count: u32
) {
    // Caution: 1D workgroup only. Deriving sid from threadid.x assumes threads
    // of the same subgroup are contiguous along x, which WebGPU guarantees.
    let sid = threadid.x / lane_count;

    // Acquire partition index; thread 0 also arms the lookback lock.
    if (threadid.x == 0u) {
        wg_broadcast = atomicAdd(&scan_bump, 1u);
        wg_lock = LOCKED;
    }
    let part_id = workgroupUniformLoad(&wg_broadcast);

    var t_scan = array<vec4<u32>, VEC4_SPT>();

    #ifdef EXCLUSIVE_SCAN
        // Cache the pre-scan value per iteration so the final store can emit
        // an exclusive result via scan_out = t_scan - t_orig + prev.
        var t_orig = array<vec4<u32>, VEC4_SPT>();
    #endif

    // Phase 1: coalesced vec4 loads + per-thread intra-vec inclusive scan.
    {
        let s_offset = laneid + sid * lane_count * VEC4_SPT;
        let dev_offset = part_id * VEC_PART_SIZE;
        var i = s_offset + dev_offset;

        if (part_id < uniforms.threadBlocks - 1u) {
            for (var k = 0u; k < VEC4_SPT; k += 1u) {
                t_scan[k] = items[i];
                #ifdef EXCLUSIVE_SCAN
                    t_orig[k] = t_scan[k];
                #endif
                t_scan[k].y += t_scan[k].x;
                t_scan[k].z += t_scan[k].y;
                t_scan[k].w += t_scan[k].z;
                i += lane_count;
            }
        }

        if (part_id == uniforms.threadBlocks - 1u) {
            for (var k = 0u; k < VEC4_SPT; k += 1u) {
                if (i < uniforms.vecSize) {
                    t_scan[k] = items[i];
                    #ifdef EXCLUSIVE_SCAN
                        t_orig[k] = t_scan[k];
                    #endif
                    t_scan[k].y += t_scan[k].x;
                    t_scan[k].z += t_scan[k].y;
                    t_scan[k].w += t_scan[k].z;
                }
                i += lane_count;
            }
        }

        // Subgroup-wide inclusive scan across the per-thread .w totals, then
        // fold back so each thread's four-lane scan is carried forward.
        var prev = 0u;
        let lane_mask = lane_count - 1u;
        let circular_shift = (laneid + lane_mask) & lane_mask;
        for (var k = 0u; k < VEC4_SPT; k += 1u) {
            let t = subgroupShuffle(subgroupInclusiveAdd(t_scan[k].w), circular_shift);
            t_scan[k] += select(0u, t, laneid != 0u) + prev;
            prev += subgroupBroadcast(t, 0u);
        }

        if (laneid == 0u) {
            wg_reduce[sid] = prev;
        }
    }
    workgroupBarrier();

    // Phase 2: non-divergent subgroup-agnostic inclusive scan across the
    // per-subgroup totals in wg_reduce.
    let lane_log = u32(countTrailingZeros(lane_count));
    let spine_size = BLOCK_DIM >> lane_log;
    let aligned_size = 1u << ((u32(countTrailingZeros(spine_size)) + lane_log - 1u) / lane_log * lane_log);
    {
        var offset0 = 0u;
        var offset1 = 0u;
        for (var j = lane_count; j <= aligned_size; j <<= lane_log) {
            let i0 = ((threadid.x + offset0) << offset1) - offset0;
            let pred0 = i0 < spine_size;
            let t0 = subgroupInclusiveAdd(select(0u, wg_reduce[i0], pred0));
            if (pred0) {
                wg_reduce[i0] = t0;
            }
            workgroupBarrier();

            if (j != lane_count) {
                let rshift = j >> lane_log;
                let i1 = threadid.x + rshift;
                if ((i1 & (j - 1u)) >= rshift) {
                    let pred1 = i1 < spine_size;
                    let t1 = select(0u, wg_reduce[((i1 >> offset1) << offset1) - 1u], pred1);
                    if (pred1 && ((i1 + 1u) & (rshift - 1u)) != 0u) {
                        wg_reduce[i1] += t1;
                    }
                }
            } else {
                offset0 += 1u;
            }
            offset1 += lane_log;
        }
    }
    workgroupBarrier();

    // Phase 3: device broadcast. Partition 0 publishes its total as INCLUSIVE
    // immediately; all others publish as REDUCTION and upgrade after lookback.
    if (threadid.x == 0u) {
        atomicStore(&reduction[part_id], (wg_reduce[spine_size - 1u] << 2u) |
            select(FLAG_INCLUSIVE, FLAG_REDUCTION, part_id != 0u));
    }

    // Phase 4: lookback with fallback. Single-threaded lookback; on spin
    // timeout the whole workgroup cooperates to reduce the blocked partition.
    if (part_id != 0u) {
        var prev_red = 0u;
        var lookback_id = part_id - 1u;

        var lock = workgroupUniformLoad(&wg_lock);
        while (lock == LOCKED) {
            if (threadid.x == 0u) {
                var spin_count = 0u;
                for (; spin_count < MAX_SPIN_COUNT; ) {
                    let flag_payload = atomicLoad(&reduction[lookback_id]);
                    if ((flag_payload & FLAG_MASK) > FLAG_NOT_READY) {
                        prev_red += flag_payload >> 2u;
                        spin_count = 0u;
                        if ((flag_payload & FLAG_MASK) == FLAG_INCLUSIVE) {
                            atomicStore(&reduction[part_id],
                                ((prev_red + wg_reduce[spine_size - 1u]) << 2u) | FLAG_INCLUSIVE);
                            wg_broadcast = prev_red;
                            wg_lock = UNLOCKED;
                            break;
                        } else {
                            lookback_id -= 1u;
                        }
                    } else {
                        spin_count += 1u;
                    }
                }

                // Spin budget exhausted: broadcast the blocked partition id
                // for the whole workgroup to help reduce.
                if (spin_count == MAX_SPIN_COUNT) {
                    wg_broadcast = lookback_id;
                }
            }

            lock = workgroupUniformLoad(&wg_lock);
            if (lock == LOCKED) {
                let fallback_id = wg_broadcast;
                {
                    let s_offset = laneid + sid * lane_count * VEC4_SPT;
                    let dev_offset = fallback_id * VEC_PART_SIZE;
                    var i = s_offset + dev_offset;
                    var t_red = 0u;

                    for (var k = 0u; k < VEC4_SPT; k += 1u) {
                        let t = items[i];
                        t_red += dot(t, vec4<u32>(1u, 1u, 1u, 1u));
                        i += lane_count;
                    }

                    let s_red = subgroupAdd(t_red);
                    if (laneid == 0u) {
                        wg_fallback[sid] = s_red;
                    }
                }
                workgroupBarrier();

                // Non-divergent subgroup-agnostic reduction across wg_fallback.
                {
                    var offset = 0u;
                    for (var j = lane_count; j <= aligned_size; j <<= lane_log) {
                        let i = ((threadid.x + 1u) << offset) - 1u;
                        let pred0 = i < spine_size;
                        let t = subgroupAdd(select(0u, wg_fallback[i], pred0));
                        if (pred0) {
                            wg_fallback[i] = t;
                        }
                        workgroupBarrier();
                        offset += lane_log;
                    }
                }

                if (threadid.x == 0u) {
                    // atomicMax stores our fallback reduction only if no one
                    // else has (FLAG_NOT_READY = 0); it will not clobber an
                    // existing FLAG_REDUCTION or FLAG_INCLUSIVE payload.
                    let f_red = wg_fallback[spine_size - 1u];
                    let f_payload = atomicMax(&reduction[fallback_id],
                        (f_red << 2u) | select(FLAG_INCLUSIVE, FLAG_REDUCTION, fallback_id != 0u));
                    if (f_payload == 0u) {
                        prev_red += f_red;
                    } else {
                        prev_red += f_payload >> 2u;
                    }

                    if (fallback_id == 0u || (f_payload & FLAG_MASK) == FLAG_INCLUSIVE) {
                        atomicStore(&reduction[part_id],
                            ((prev_red + wg_reduce[spine_size - 1u]) << 2u) | FLAG_INCLUSIVE);
                        wg_broadcast = prev_red;
                        wg_lock = UNLOCKED;
                    } else {
                        lookback_id -= 1u;
                    }
                }
                lock = workgroupUniformLoad(&wg_lock);
            }
        }
    }

    // Phase 5: write output. wg_broadcast now holds the exclusive prefix of
    // this partition (0 for partition 0). wg_reduce[sid - 1] is the exclusive
    // prefix of this subgroup within this partition.
    {
        let prev = wg_broadcast + select(0u, wg_reduce[sid - 1u], sid != 0u);
        let s_offset = laneid + sid * lane_count * VEC4_SPT;
        let dev_offset = part_id * VEC_PART_SIZE;
        var i = s_offset + dev_offset;

        if (part_id < uniforms.threadBlocks - 1u) {
            for (var k = 0u; k < VEC4_SPT; k += 1u) {
                #ifdef EXCLUSIVE_SCAN
                    items[i] = t_scan[k] - t_orig[k] + prev;
                #else
                    items[i] = t_scan[k] + prev;
                #endif
                i += lane_count;
            }
        }

        if (part_id == uniforms.threadBlocks - 1u) {
            for (var k = 0u; k < VEC4_SPT; k += 1u) {
                if (i < uniforms.vecSize) {
                    #ifdef EXCLUSIVE_SCAN
                        items[i] = t_scan[k] - t_orig[k] + prev;
                    #else
                        items[i] = t_scan[k] + prev;
                    #endif
                }
                i += lane_count;
            }
        }
    }
}
`;

export default csdldfScanSource;
