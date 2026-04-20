// Per-splat projection + projection cache write + atomic per-tile counting + pair buffer writes.
//
// Single splat per thread with per-thread atomicAdd for pair buffer reservation
// (no barrier, no shared memory).
//
// Bitmask: 8x4 = 32 bits in a single u32. The bit index localY * 8 + localX compiles
// to a pure shift (localY << 3 | localX). Tiles outside the 8x4 region fall back to
// intersection recomputation. Splats over 64 tiles are deferred to the cooperative
// large-splat pass.
//
// Structure:
//   Phase 1 — project, write projCache/depthBuffer, count tiles, build bitmask.
//   Atomic  — one atomicAdd per thread to reserve pair buffer space.
//   Phase 2 — write pairs using bitmask. All data stays in registers from Phase 1.
//
// The pair buffer is later consumed by a lightweight PlaceEntries pass that writes
// tileEntries using prefix-summed offsets — zero atomics, zero projCache reads.
export const computeGsplatLocalTileCountSource = /* wgsl */`

#include "gsplatCommonCS"
#include "gsplatTileIntersectCS"

// Caps the 16-bit localOffset field in packed pairs (tileIdx << 16 | localOffset).
const MAX_TILE_ENTRIES: u32 = 0xFFFFu;

// 8x4 = 32 bits fits in a single u32 bitmask. The bit index localY * 8 + localX
// compiles to a pure shift (localY << 3 | localX), avoiding any multiply.
const BITMASK_W: u32 = 8u;
const BITMASK_H: u32 = 4u;

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
// countersBuffer packs two atomic counters: [0] = global pair counter, [1] = large splat count.
@group(0) @binding(5) var<storage, read_write> pairBuffer: array<u32>;
@group(0) @binding(6) var<storage, read_write> countersBuffer: array<atomic<u32>>;
@group(0) @binding(7) var<storage, read_write> splatPairStart: array<u32>;
@group(0) @binding(8) var<storage, read_write> splatPairCount: array<u32>;
@group(0) @binding(9) var<storage, read_write> largeSplatIds: array<u32>;
@group(0) @binding(10) var<storage, read_write> depthBuffer: array<u32>;

#include "gsplatComputeSplatCS"
#include "gsplatFormatDeclCS"
#include "gsplatFormatReadCS"

// NOTE on tile entry cap: if a tile exceeds MAX_TILE_ENTRIES (65535), the atomicAdd
// count overcounts. Impact: the prefix sum allocates extra tileEntries slots that go
// unwritten (wasting capacity), and the rasterize pass processes stale/zero entries in
// those slots (minor visual artifacts). In practice, minContribution and minPixelSize
// culling remove small/distant splats before tile counting, limiting per-tile density
// when zoomed out and making overflow unlikely.

@compute @workgroup_size(256)
fn main(
    @builtin(global_invocation_id) gid: vec3u,
    @builtin(num_workgroups) numWorkgroups: vec3u
) {
    let threadIdx = gid.y * (numWorkgroups.x * 256u) + gid.x;
    let numVisible = sortElementCount[0];

    if (threadIdx >= numVisible) {
        return;
    }

    let splatId = compactedSplatIds[threadIdx];
    setSplat(splatId);
    let center = getCenter();
    let opacity = getOpacity();

    if (opacity < uniforms.alphaClip) {
        projCache[threadIdx * {CACHE_STRIDE}u + 6u] = 0u;
        splatPairStart[threadIdx] = 0u;
        splatPairCount[threadIdx] = 0u;
        return;
    }

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

    if (!proj.valid) {
        projCache[threadIdx * {CACHE_STRIDE}u + 6u] = 0u;
        splatPairStart[threadIdx] = 0u;
        splatPairCount[threadIdx] = 0u;
        return;
    }

    let det = proj.a * proj.c - proj.b * proj.b;
    let invDet = 1.0 / det;
    let cx = 4.0 * proj.c * invDet;
    let cy = -4.0 * proj.b * invDet;
    let cz = 4.0 * proj.a * invDet;

    let base = threadIdx * {CACHE_STRIDE}u;
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

    depthBuffer[threadIdx] = bitcast<u32>(proj.viewDepth);

    let screen = proj.screen;
    let eval = computeSplatTileEval(screen, cx, cy, cz, half(opacity),
                                    uniforms.viewportWidth, uniforms.viewportHeight,
                                    uniforms.alphaClip);
    let radiusFactor = eval.radiusFactor;

    // Per-splat power cutoff for the rasterize pass: the Gaussian exponent below which
    // the splat's contribution at a pixel drops below alphaClip. Equal to -radiusFactor / 2
    // = -log(opacity / alphaClip), clamped with radiusFactor. For high-opacity splats this
    // is -4 (matching the global cutoff); for low-opacity splats it's tighter, letting the
    // rasterize kernel skip exp() and the blend chain entirely for non-contributing pixels.
    projCache[base + 7u] = bitcast<u32>(-0.5 * radiusFactor);

    let minTileX = max(0i, i32(floor(eval.splatMin.x / f32(TILE_SIZE))));
    let maxTileX = min(i32(uniforms.numTilesX) - 1i, i32(floor(eval.splatMax.x / f32(TILE_SIZE))));
    let minTileY = max(0i, i32(floor(eval.splatMin.y / f32(TILE_SIZE))));
    let maxTileY = min(i32(uniforms.numTilesY) - 1i, i32(floor(eval.splatMax.y / f32(TILE_SIZE))));

    let aabbW = u32(maxTileX - minTileX + 1i);

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
        let idx = atomicAdd(&countersBuffer[1], 1u);
        if (idx < arrayLength(&largeSplatIds)) {
            largeSplatIds[idx] = threadIdx;
            deferredToLarge = true;
        }
    }

    if (deferredToLarge) {
        splatPairStart[threadIdx] = 0u;
        splatPairCount[threadIdx] = 0u;
        return;
    }

    // =========================================================================
    // Phase 1: Count tiles + build bitmask (pure ALU, no atomics)
    // =========================================================================
    var myPairCount: u32 = 0u;
    var bitmask: u32 = 0u;

    if (minTileX == maxTileX && minTileY == maxTileY) {
        myPairCount = 1u;
        bitmask = 1u;
    } else {
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
    }

    if (myPairCount == 0u) {
        splatPairStart[threadIdx] = 0u;
        splatPairCount[threadIdx] = 0u;
        return;
    }

    // =========================================================================
    // Per-thread pair buffer reservation (no barrier, no shared memory)
    // =========================================================================
    let pairBase = atomicAdd(&countersBuffer[0], myPairCount);

    // =========================================================================
    // Phase 2: Write pairs using bitmask (all data in registers from Phase 1)
    // =========================================================================
    splatPairStart[threadIdx] = pairBase;
    splatPairCount[threadIdx] = myPairCount;

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
                    pairBuffer[pairBase + j] = (tileIdx << 16u) | (localOff & 0xFFFFu);
                    j++;
                }
            }
        }
    }

    if (j != myPairCount) {
        splatPairCount[threadIdx] = j;
    }
}
`;
