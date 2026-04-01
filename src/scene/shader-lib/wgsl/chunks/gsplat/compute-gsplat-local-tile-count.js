// Per-splat projection + projection cache write + atomic per-tile counting.
// Each thread processes one visible splat from the compacted ID list.
export const computeGsplatLocalTileCountSource = /* wgsl */`

#include "gsplatCommonCS"
#include "gsplatTileIntersectCS"

const CACHE_STRIDE: u32 = 8u;

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
}
@group(0) @binding(4) var<uniform> uniforms: Uniforms;

#include "gsplatComputeSplatCS"
#include "gsplatFormatDeclCS"
#include "gsplatFormatReadCS"

@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) gid: vec3u, @builtin(num_workgroups) numWorkgroups: vec3u) {
    let threadIdx = gid.y * (numWorkgroups.x * 256u) + gid.x;
    let numVisible = sortElementCount[0];
    if (threadIdx >= numVisible) {
        return;
    }

    let splatId = compactedSplatIds[threadIdx];

    // Call order: getCenter() first, then getOpacity() for early culling,
    // then getRotation()/getScale(), then getColor() only for visible splats.
    setSplat(splatId);
    let center = getCenter();
    let opacity = getOpacity();

    if (opacity < uniforms.alphaClip) {
        projCache[threadIdx * CACHE_STRIDE + 6u] = 0u;
        return;
    }

    let rotation = half4(getRotation());
    let scale = half3(getScale());

    let proj = computeSplatCov(
        center, rotation, scale,
        uniforms.viewMatrix, uniforms.viewProj,
        uniforms.focal, uniforms.viewportWidth, uniforms.viewportHeight,
        uniforms.nearClip, uniforms.farClip, opacity, uniforms.minPixelSize,
        uniforms.isOrtho, uniforms.alphaClip
    );

    if (!proj.valid) {
        projCache[threadIdx * CACHE_STRIDE + 6u] = 0u;
        return;
    }

    let det = proj.a * proj.c - proj.b * proj.b;
    let invDet = 1.0 / det;
    let cx = 4.0 * proj.c * invDet;
    let cy = -4.0 * proj.b * invDet;
    let cz = 4.0 * proj.a * invDet;

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

    let eval = computeSplatTileEval(proj.screen, cx, cy, cz, half(opacity),
                                    uniforms.viewportWidth, uniforms.viewportHeight,
                                    uniforms.alphaClip);

    let minTileX = max(0i, i32(floor(eval.splatMin.x / f32(TILE_SIZE))));
    let maxTileX = min(i32(uniforms.numTilesX) - 1i, i32(floor(eval.splatMax.x / f32(TILE_SIZE))));
    let minTileY = max(0i, i32(floor(eval.splatMin.y / f32(TILE_SIZE))));
    let maxTileY = min(i32(uniforms.numTilesY) - 1i, i32(floor(eval.splatMax.y / f32(TILE_SIZE))));

    for (var ty = minTileY; ty <= maxTileY; ty++) {
        for (var tx = minTileX; tx <= maxTileX; tx++) {
            let tMin = vec2f(f32(tx) * f32(TILE_SIZE), f32(ty) * f32(TILE_SIZE));
            let tMax = tMin + vec2f(f32(TILE_SIZE));
            if (tileIntersectsEllipse(tMin, tMax, proj.screen, cx, cy, cz, eval.radiusFactor)) {
                let tileIdx = u32(ty) * uniforms.numTilesX + u32(tx);
                atomicAdd(&tileSplatCounts[tileIdx], 1u);
            }
        }
    }
}
`;
