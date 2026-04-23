// OneSweep - Scan kernel
//
// Exclusive scan of the 256-entry `b_globalHist` slice for each radix pass,
// writing the resulting exclusive prefixes into block 0's slot of
// `b_passHist` with FLAG_INCLUSIVE. This bootstraps the chained lookback so
// every subsequent block can terminate its lookback when it walks back to
// partition index 0.
//
// Dispatched as NUM_PASSES workgroups × 256 threads. Workgroup id selects the
// radix pass being scanned.
//
// Ported from `SweepCommon.hlsl::Scan` / `GlobalHistExclusiveScanWGE16` of
// [b0nes164/GPUSorting](https://github.com/b0nes164/GPUSorting) (MIT License).

export const onesweepScanSource = /* wgsl */`

@group(0) @binding(0) var<storage, read> b_globalHist: array<u32>;
@group(0) @binding(1) var<storage, read_write> b_passHist: array<atomic<u32>>;

struct OneSweepScanUniforms {
    threadBlocks: u32,   // number of DigitBinningPass workgroups per pass
    _pad0: u32,
    _pad1: u32,
    _pad2: u32
};
@group(0) @binding(2) var<uniform> uniforms: OneSweepScanUniforms;

const RADIX: u32 = 256u;
const FLAG_INCLUSIVE: u32 = 2u;

// Parametrized by the host from device.maxSubgroupSize (256 / sgSize).
const MAX_SUBGROUPS: u32 = {MAX_SUBGROUPS}u;

// Scratch for the hierarchical exclusive scan. sg_totals holds one entry per
// subgroup; lane 0 of the workgroup scans it serially.
var<workgroup> g_scan: array<u32, RADIX>;
var<workgroup> sg_totals: array<u32, MAX_SUBGROUPS>;

@compute @workgroup_size(RADIX, 1, 1)
fn main(
    @builtin(local_invocation_index) gtid: u32,
    @builtin(workgroup_id) gid: vec3<u32>,
    @builtin(subgroup_invocation_id) sgInvId: u32,
    @builtin(subgroup_size) sgSize: u32,
) {
    let pass_ = gid.x;
    let threadBlocks = uniforms.threadBlocks;
    let waveIndex = gtid / sgSize;

    // Load this pass's digit counts.
    let t = b_globalHist[gtid + pass_ * RADIX];

    // Phase 1: subgroup-level exclusive scan.
    let sgExcl = subgroupExclusiveAdd(t);
    let sgTotal = subgroupAdd(t);

    if (sgInvId == 0u) {
        sg_totals[waveIndex] = sgTotal;
    }
    workgroupBarrier();

    // Phase 2: scan the subgroup totals (serially in thread 0; MAX_SUBGROUPS entries).
    if (gtid == 0u) {
        var acc: u32 = 0u;
        for (var i = 0u; i < MAX_SUBGROUPS; i = i + 1u) {
            let v = sg_totals[i];
            sg_totals[i] = acc;
            acc = acc + v;
        }
    }
    workgroupBarrier();

    // Phase 3: combine subgroup-local prefix with the subgroup base.
    let excl = sgExcl + sg_totals[waveIndex];
    g_scan[gtid] = excl;

    // Publish to block-0 slot of passHist with FLAG_INCLUSIVE.
    // Layout: b_passHist[pass * threadBlocks * RADIX + block * RADIX + digit].
    let dst = pass_ * threadBlocks * RADIX + gtid;
    atomicStore(&b_passHist[dst], (excl << 2u) | FLAG_INCLUSIVE);
}
`;

export default onesweepScanSource;
