// Per-splat projection + projection cache write + atomic per-tile counting + pair buffer writes.
//
// This pass merges what was previously two separate dispatches (count + scatter) into one.
// The old scatter pass re-read projCache and recomputed tile intersections just to place
// splat indices into per-tile entry lists via global atomics — redundant and expensive.
//
// New approach: iterate tiles twice within the same dispatch.
//   Loop 1 (count-only): counts overlapping tiles per splat and builds a 6x5 bitmask
//     recording which tiles passed the intersection test. Pure ALU, no atomics.
//   Workgroup barrier: prefix sum over per-thread pair counts, then one global atomicAdd
//     per workgroup to allocate a contiguous block in the pair buffer.
//   Loop 2 (count + pair-write): performs atomicAdd on tileSplatCounts and writes
//     (tileIdx, localOffset) pairs to the pair buffer. Uses the bitmask to skip intersection
//     recomputation for AABBs within 6x5 tiles (covers ~95% of splats). Larger AABBs use
//     the bitmask for the first 6x5 region and recompute intersection for the remainder.
//
// All projection data (screen, cx/cy/cz, radiusFactor, tile AABB) persists in registers
// across the workgroup barrier, so the second loop only re-evaluates cheap bitmask lookups.
//
// The pair buffer is later consumed by a lightweight PlaceEntries pass that writes
// tileEntries using prefix-summed offsets — zero atomics, zero projCache reads.
export const computeGsplatLocalTileCountSource = /* wgsl */`

#include "gsplatCommonCS"
#include "gsplatTileIntersectCS"

const CACHE_STRIDE: u32 = 8u;
const WG_SIZE: u32 = 256u;

// Caps the 16-bit localOffset field in packed pairs (tileIdx << 16 | localOffset).
const MAX_TILE_ENTRIES: u32 = 0xFFFFu;

// 6x5 = 30 bits fits in a single u32 bitmask. Covers ~95% of splats without needing
// to recompute the intersection test in the second tile loop.
const BITMASK_W: u32 = 6u;
const BITMASK_H: u32 = 5u;

// Splats whose AABB exceeds this many tiles are deferred to a cooperative
// large-splat pass where 256 threads handle them in parallel, eliminating
// the wavefront divergence that otherwise causes a long GPU tail.
const LARGE_AABB_THRESHOLD: u32 = 64u;

@group(0) @binding(0) var<storage, read> compactedSplatIds: array<u32>;
@group(0) @binding(1) var<storage, read> sortElementCount: array<u32>;
@group(0) @binding(2) var<storage, read_write> projCache: array<u32>;
@group(0) @binding(3) var<storage, read_write> tileSplatCounts: array<atomic<u32>>;

struct Uniforms {
    splatTextureSize: u32,
    numTilesX: u32,
    numTilesY: u32,
    viewProj: mat4x4f,
    viewMatrix: mat4x4f,
    focal: f32,
    viewportWidth: f32,
    viewportHeight: f32,
    nearClip: f32,
    farClip: f32,
    minPixelSize: f32,
    isOrtho: u32,
    exposure: f32,
    alphaClip: f32,
    minContribution: f32,
    #ifdef GSPLAT_FISHEYE
        fisheye_k: f32,
        fisheye_inv_k: f32,
        fisheye_projMat00: f32,
        fisheye_projMat11: f32,
    #endif
}
@group(0) @binding(4) var<uniform> uniforms: Uniforms;

// Pair buffer bindings for the scatter-free approach.
// pairBuffer stores packed (tileIdx << 16 | localOffset) per splat-tile intersection.
// splatPairStart/splatPairCount let the PlaceEntries pass locate each splat's pairs.
@group(0) @binding(5) var<storage, read_write> pairBuffer: array<u32>;
@group(0) @binding(6) var<storage, read_write> globalPairCounter: array<atomic<u32>>;
@group(0) @binding(7) var<storage, read_write> splatPairStart: array<u32>;
@group(0) @binding(8) var<storage, read_write> splatPairCount: array<u32>;
@group(0) @binding(9) var<storage, read_write> largeSplatIds: array<u32>;
@group(0) @binding(10) var<storage, read_write> largeSplatCount: array<atomic<u32>>;

#include "gsplatComputeSplatCS"
#include "gsplatFormatDeclCS"
#include "gsplatFormatReadCS"

// Shared memory for workgroup-level pair buffer allocation.
// Each thread publishes its pair count; a serial prefix sum computes offsets;
// the leader thread reserves a contiguous global block with a single atomicAdd.
var<workgroup> wgPairCounts: array<u32, WG_SIZE>;
var<workgroup> wgPairOffsets: array<u32, WG_SIZE>;
var<workgroup> wgBase: u32;

// NOTE on tile entry cap: if a tile exceeds MAX_TILE_ENTRIES (65535), the atomicAdd
// count overcounts. Impact: the prefix sum allocates extra tileEntries slots that go
// unwritten (wasting capacity), and the rasterize pass processes stale/zero entries in
// those slots (minor visual artifacts). In practice, minContribution and minPixelSize
// culling remove small/distant splats before tile counting, limiting per-tile density
// when zoomed out and making overflow unlikely.

@compute @workgroup_size(256)
fn main(
    @builtin(global_invocation_id) gid: vec3u,
    @builtin(num_workgroups) numWorkgroups: vec3u,
    @builtin(local_invocation_index) localIdx: u32
) {
    let threadIdx = gid.y * (numWorkgroups.x * 256u) + gid.x;
    let numVisible = sortElementCount[0];

    // Threads beyond numVisible still participate in the workgroup prefix sum
    // and barrier — they just contribute zero pairs.
    var myPairCount: u32 = 0u;
    var bitmask: u32 = 0u;
    var minTileX: i32 = 0i;
    var maxTileX: i32 = -1i;
    var minTileY: i32 = 0i;
    var maxTileY: i32 = -1i;
    var screen: vec2f = vec2f(0.0);
    var cx: f32 = 0.0;
    var cy: f32 = 0.0;
    var cz: f32 = 0.0;
    var radiusFactor: f32 = 0.0;
    var aabbW: u32 = 0u;
    var isVisible: bool = false;

    if (threadIdx < numVisible) {
        let splatId = compactedSplatIds[threadIdx];

        setSplat(splatId);
        let center = getCenter();
        let opacity = getOpacity();

        if (opacity >= uniforms.alphaClip) {
            let rotation = half4(getRotation());
            let scale = half3(getScale());

            let proj = computeSplatCov(
                center, rotation, scale,
                uniforms.viewMatrix, uniforms.viewProj,
                uniforms.focal, uniforms.viewportWidth, uniforms.viewportHeight,
                uniforms.nearClip, uniforms.farClip, opacity, uniforms.minPixelSize,
                uniforms.isOrtho, uniforms.alphaClip, uniforms.minContribution,
                #ifdef GSPLAT_FISHEYE
                    uniforms.fisheye_k, uniforms.fisheye_inv_k,
                    uniforms.fisheye_projMat00, uniforms.fisheye_projMat11,
                #endif
            );

            if (proj.valid) {
                isVisible = true;

                let det = proj.a * proj.c - proj.b * proj.b;
                let invDet = 1.0 / det;
                cx = 4.0 * proj.c * invDet;
                cy = -4.0 * proj.b * invDet;
                cz = 4.0 * proj.a * invDet;

                let base = threadIdx * CACHE_STRIDE;
                projCache[base + 0u] = bitcast<u32>(proj.screen.x);
                projCache[base + 1u] = bitcast<u32>(proj.screen.y);
                projCache[base + 2u] = bitcast<u32>(cx);
                projCache[base + 3u] = bitcast<u32>(cy);
                projCache[base + 4u] = bitcast<u32>(cz);

            #ifdef PICK_MODE
                let pcIdVal = loadPcId().r;
                projCache[base + 5u] = pcIdVal;
                projCache[base + 6u] = pack2x16float(vec2f(0.0, opacity));
            #else
                let color = getColor();
                var rgb = max(color, vec3f(0.0));
                projCache[base + 5u] = pack2x16float(vec2f(rgb.x, rgb.y));
                projCache[base + 6u] = pack2x16float(vec2f(rgb.z, opacity));
            #endif

                projCache[base + 7u] = bitcast<u32>(proj.viewDepth);

                screen = proj.screen;
                let eval = computeSplatTileEval(screen, cx, cy, cz, half(opacity),
                                                uniforms.viewportWidth, uniforms.viewportHeight,
                                                uniforms.alphaClip);
                radiusFactor = eval.radiusFactor;

                minTileX = max(0i, i32(floor(eval.splatMin.x / f32(TILE_SIZE))));
                maxTileX = min(i32(uniforms.numTilesX) - 1i, i32(floor(eval.splatMax.x / f32(TILE_SIZE))));
                minTileY = max(0i, i32(floor(eval.splatMin.y / f32(TILE_SIZE))));
                maxTileY = min(i32(uniforms.numTilesY) - 1i, i32(floor(eval.splatMax.y / f32(TILE_SIZE))));

                aabbW = u32(maxTileX - minTileX + 1i);

                // Defer large splats to the cooperative large-splat pass where
                // 256 threads process them in parallel, avoiding wavefront divergence.
                // If the buffer overflows, fall through to normal single-thread processing.
                // Guard: when capScale shrinks the tile-eval radius below the frustum-cull
                // radius, maxTile can drop below minTile. The u32 cast of that negative
                // difference wraps to ~4 billion, falsely triggering the threshold.
                // The original loop handles this harmlessly (minTile > maxTile → 0 iters),
                // so we must not classify these degenerate AABBs as large.
                var deferredToLarge = false;
                if (maxTileX >= minTileX && maxTileY >= minTileY &&
                    aabbW * u32(maxTileY - minTileY + 1i) > LARGE_AABB_THRESHOLD) {
                    let idx = atomicAdd(&largeSplatCount[0], 1u);
                    if (idx < arrayLength(&largeSplatIds)) {
                        largeSplatIds[idx] = threadIdx;
                        deferredToLarge = true;
                    }
                }

                if (!deferredToLarge) {

                // Fast path: 1x1 AABB — the splat definitely intersects its only tile,
                // skip the intersection test entirely.
                if (minTileX == maxTileX && minTileY == maxTileY) {
                    myPairCount = 1u;
                    bitmask = 1u;
                } else {

                // --- Loop 1: count-only + bitmask ---
                // Pure ALU — no atomics, no memory writes. Records which tiles within the
                // AABB pass the ellipse intersection test. The bitmask avoids recomputing
                // intersections in Loop 2. Always populated for the first 6x5 tiles of the
                // AABB regardless of AABB size.
                for (var ty = minTileY; ty <= maxTileY; ty++) {
                    for (var tx = minTileX; tx <= maxTileX; tx++) {
                        let tMin = vec2f(f32(tx) * f32(TILE_SIZE), f32(ty) * f32(TILE_SIZE));
                        let tMax = tMin + vec2f(f32(TILE_SIZE));
                        if (tileIntersectsEllipse(tMin, tMax, screen, cx, cy, cz, radiusFactor)) {
                            myPairCount++;
                            let localX = u32(tx - minTileX);
                            let localY = u32(ty - minTileY);
                            if (localX < BITMASK_W && localY < BITMASK_H) {
                                let bitIdx = localY * BITMASK_W + localX;
                                bitmask |= (1u << bitIdx);
                            }
                        }
                    }
                }

                } // end else (non-1x1)
                } // end if (!deferredToLarge)
            }
        }

        // Zero out opacity marker for invisible splats so downstream passes skip them
        if (!isVisible) {
            projCache[threadIdx * CACHE_STRIDE + 6u] = 0u;
        }
    }

    // --- Workgroup prefix sum + global pair buffer allocation ---
    // All threads (including inactive ones beyond numVisible) participate in the barrier.
    // The prefix sum computes per-thread offsets within the workgroup's pair block.
    // A single global atomicAdd per workgroup reserves a contiguous region, reducing
    // global atomic contention from ~44M (old scatter) to ~60K (one per workgroup).
    wgPairCounts[localIdx] = myPairCount;
    workgroupBarrier();

    if (localIdx == 0u) {
        var sum: u32 = 0u;
        for (var i: u32 = 0u; i < WG_SIZE; i++) {
            wgPairOffsets[i] = sum;
            sum += wgPairCounts[i];
        }
        if (sum > 0u) {
            wgBase = atomicAdd(&globalPairCounter[0], sum);
        } else {
            wgBase = 0u;
        }
    }
    workgroupBarrier();

    if (myPairCount == 0u) {
        if (threadIdx < numVisible) {
            splatPairStart[threadIdx] = 0u;
            splatPairCount[threadIdx] = 0u;
        }
        return;
    }

    let myBase = wgBase + wgPairOffsets[localIdx];

    splatPairStart[threadIdx] = myBase;
    splatPairCount[threadIdx] = myPairCount;

    // --- Loop 2: atomicAdd on tileSplatCounts + pair writes ---
    // Uses the bitmask from Loop 1 to skip intersection tests for splats fitting
    // in the 6x5 region. For larger AABBs, the bitmask covers the first 6x5 rows/columns
    // and intersection is recomputed only for tiles outside that region.
    var j: u32 = 0u;
    for (var ty = minTileY; ty <= maxTileY; ty++) {
        for (var tx = minTileX; tx <= maxTileX; tx++) {

            let localX = u32(tx - minTileX);
            let localY = u32(ty - minTileY);

            var hits: bool;
            if (localX < BITMASK_W && localY < BITMASK_H) {
                let bitIdx = localY * BITMASK_W + localX;
                hits = (bitmask & (1u << bitIdx)) != 0u;
            } else {
                let tMin = vec2f(f32(tx) * f32(TILE_SIZE), f32(ty) * f32(TILE_SIZE));
                let tMax = tMin + vec2f(f32(TILE_SIZE));
                hits = tileIntersectsEllipse(tMin, tMax, screen, cx, cy, cz, radiusFactor);
            }

            if (hits) {
                let tileIdx = u32(ty) * uniforms.numTilesX + u32(tx);
                let localOff = atomicAdd(&tileSplatCounts[tileIdx], 1u);
                if (localOff < MAX_TILE_ENTRIES) {
                    pairBuffer[myBase + j] = (tileIdx << 16u) | (localOff & 0xFFFFu);
                    j++;
                }
            }
        }
    }

    // If some pairs were dropped by the cap, update the stored count to reflect
    // only the pairs actually written.
    if (j != myPairCount) {
        splatPairCount[threadIdx] = j;
    }
}
`;
