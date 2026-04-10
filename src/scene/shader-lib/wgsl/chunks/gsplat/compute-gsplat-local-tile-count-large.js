// Cooperative large-splat tile-count pass: one workgroup (256 threads) per large splat.
//
// Large splats whose AABB exceeds LARGE_AABB_THRESHOLD tiles are deferred here by the
// main tile-count pass to eliminate wavefront divergence. Without this, a single thread
// looping over hundreds of tiles holds up the entire workgroup while all other threads
// sit idle — causing occupancy to drop to ~2% and a long GPU tail.
//
// Each workgroup reads the splat's projection from projCache (already written by the
// main pass), recomputes the AABB from the stored conic values, and 256 threads
// cooperatively iterate the tiles. The same prefix-sum + pair-buffer pattern is used,
// writing to the same shared data structures (tileSplatCounts, pairBuffer,
// splatPairStart/Count). The high bit of splatPairCount is set to flag these splats
// so the regular PlaceEntries pass skips them; the cooperative LargePlaceEntries pass
// masks it off when reading the count.
export const computeGsplatLocalTileCountLargeSource = /* wgsl */`

#include "gsplatCommonCS"
#include "gsplatTileIntersectCS"

const CACHE_STRIDE: u32 = 8u;
const WG_SIZE: u32 = 256u;
const MAX_TILE_ENTRIES: u32 = 0xFFFFu;

@group(0) @binding(0) var<storage, read> projCache: array<u32>;
@group(0) @binding(1) var<storage, read_write> tileSplatCounts: array<atomic<u32>>;
@group(0) @binding(2) var<storage, read_write> pairBuffer: array<u32>;
@group(0) @binding(3) var<storage, read_write> globalPairCounter: array<atomic<u32>>;
@group(0) @binding(4) var<storage, read_write> splatPairStart: array<u32>;
@group(0) @binding(5) var<storage, read_write> splatPairCount: array<u32>;
@group(0) @binding(6) var<storage, read> largeSplatIds: array<u32>;
@group(0) @binding(7) var<storage, read> largeSplatCount: array<u32>;

struct Uniforms {
    numTilesX: u32,
    numTilesY: u32,
    viewportWidth: f32,
    viewportHeight: f32,
    alphaClip: f32,
}
@group(0) @binding(8) var<uniform> uniforms: Uniforms;

var<workgroup> wgPairCounts: array<u32, WG_SIZE>;
var<workgroup> wgPairOffsets: array<u32, WG_SIZE>;
var<workgroup> wgBase: u32;

@compute @workgroup_size(256)
fn main(
    @builtin(workgroup_id) wgId: vec3u,
    @builtin(num_workgroups) numWorkgroups: vec3u,
    @builtin(local_invocation_index) lid: u32
) {
    let largeSplatIdx = wgId.y * numWorkgroups.x + wgId.x;
    let count = min(largeSplatCount[0], arrayLength(&largeSplatIds));
    if (largeSplatIdx >= count) {
        return;
    }

    let threadIdx = largeSplatIds[largeSplatIdx];

    let cacheBase = threadIdx * CACHE_STRIDE;
    let screen = vec2f(bitcast<f32>(projCache[cacheBase + 0u]), bitcast<f32>(projCache[cacheBase + 1u]));
    let cx = bitcast<f32>(projCache[cacheBase + 2u]);
    let cy = bitcast<f32>(projCache[cacheBase + 3u]);
    let cz = bitcast<f32>(projCache[cacheBase + 4u]);
    let opacity = unpack2x16float(projCache[cacheBase + 6u]).y;

    let eval = computeSplatTileEval(screen, cx, cy, cz, half(opacity),
                                    uniforms.viewportWidth, uniforms.viewportHeight,
                                    uniforms.alphaClip);
    let radiusFactor = eval.radiusFactor;

    let minTileX = max(0i, i32(floor(eval.splatMin.x / f32(TILE_SIZE))));
    let maxTileX = min(i32(uniforms.numTilesX) - 1i, i32(floor(eval.splatMax.x / f32(TILE_SIZE))));
    let minTileY = max(0i, i32(floor(eval.splatMin.y / f32(TILE_SIZE))));
    let maxTileY = min(i32(uniforms.numTilesY) - 1i, i32(floor(eval.splatMax.y / f32(TILE_SIZE))));

    // Guard against degenerate AABBs where maxTile < minTile. This can happen
    // when capScale-driven radius shrinkage makes the tile-eval AABB smaller than
    // the frustum-cull AABB. The u32 cast of the negative difference would wrap
    // to ~4 billion, causing the tile loops to iterate for millions of iterations
    // per thread and hang the GPU.
    var aabbW = u32(0);
    var aabbH = u32(0);
    var totalTiles = u32(0);
    if (maxTileX >= minTileX && maxTileY >= minTileY) {
        aabbW = u32(maxTileX - minTileX + 1i);
        aabbH = u32(maxTileY - minTileY + 1i);
        totalTiles = aabbW * aabbH;
    }

    // --- Phase 1: each thread counts its intersecting tiles ---
    var myHitCount: u32 = 0u;
    for (var i = lid; i < totalTiles; i += WG_SIZE) {
        let localX = i % aabbW;
        let localY = i / aabbW;
        let tx = minTileX + i32(localX);
        let ty = minTileY + i32(localY);
        let tMin = vec2f(f32(tx) * f32(TILE_SIZE), f32(ty) * f32(TILE_SIZE));
        let tMax = tMin + vec2f(f32(TILE_SIZE));
        if (tileIntersectsEllipse(tMin, tMax, screen, cx, cy, cz, radiusFactor)) {
            myHitCount++;
        }
    }

    // --- Workgroup prefix sum + global pair allocation ---
    wgPairCounts[lid] = myHitCount;
    workgroupBarrier();

    if (lid == 0u) {
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
        splatPairStart[threadIdx] = wgBase;
        splatPairCount[threadIdx] = sum | 0x80000000u;
    }
    workgroupBarrier();

    let myBase = wgBase + wgPairOffsets[lid];

    // --- Phase 2: write pairs with atomicAdd on tileSplatCounts ---
    var j: u32 = 0u;
    for (var i = lid; i < totalTiles; i += WG_SIZE) {
        let localX = i % aabbW;
        let localY = i / aabbW;
        let tx = minTileX + i32(localX);
        let ty = minTileY + i32(localY);
        let tMin = vec2f(f32(tx) * f32(TILE_SIZE), f32(ty) * f32(TILE_SIZE));
        let tMax = tMin + vec2f(f32(TILE_SIZE));
        if (tileIntersectsEllipse(tMin, tMax, screen, cx, cy, cz, radiusFactor)) {
            let tileIdx = u32(ty) * uniforms.numTilesX + u32(tx);
            let localOff = atomicAdd(&tileSplatCounts[tileIdx], 1u);
            if (localOff < MAX_TILE_ENTRIES) {
                pairBuffer[myBase + j] = (tileIdx << 16u) | (localOff & 0xFFFFu);
                j++;
            }
        }
    }

    // If any pairs were dropped by the cap, correct the stored count via workgroup sum.
    wgPairCounts[lid] = j;
    workgroupBarrier();
    if (lid == 0u) {
        var actualTotal: u32 = 0u;
        for (var i: u32 = 0u; i < WG_SIZE; i++) {
            actualTotal += wgPairCounts[i];
        }
        let storedCount = splatPairCount[threadIdx] & 0x7FFFFFFFu;
        if (actualTotal != storedCount) {
            splatPairCount[threadIdx] = actualTotal | 0x80000000u;
        }
    }
}
`;
