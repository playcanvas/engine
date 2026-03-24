export const computeGsplatTileCountSource = /* wgsl */`

#include "gsplatCommonCS"
#include "gsplatTileIntersectCS"
#include "gsplatOutputVS"

const CACHE_STRIDE: u32 = 7u;

@group(0) @binding(0) var<storage, read> splatOrder: array<u32>;
@group(0) @binding(1) var<storage, read_write> splatTileCounts: array<u32>;
@group(0) @binding(2) var<storage, read_write> projCache: array<u32>;

struct Uniforms {
    numSplats: u32,
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
}
@group(0) @binding(3) var<uniform> uniforms: Uniforms;

#include "gsplatComputeSplatCS"
#include "gsplatFormatDeclCS"
#include "gsplatFormatReadCS"

@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) gid: vec3u, @builtin(num_workgroups) numWorkgroups: vec3u) {
    let threadIdx = gid.y * (numWorkgroups.x * 256u) + gid.x;
    if (threadIdx >= uniforms.numSplats) {
        return;
    }

    let splatId = splatOrder[uniforms.numSplats - 1u - threadIdx];

    // Call order: getCenter() first, then getOpacity() for early culling,
    // then getRotation()/getScale(), then getColor() only for visible splats.
    setSplat(splatId);
    let center = getCenter();
    let opacity = getOpacity();

    if (opacity < 1.0 / 255.0) {
        splatTileCounts[threadIdx] = 0u;
        return;
    }

    let rotation = half4(getRotation());
    let scale = half3(getScale());

    let proj = computeSplatCov(
        center, rotation, scale,
        uniforms.viewMatrix, uniforms.viewProj,
        uniforms.focal, uniforms.viewportWidth, uniforms.viewportHeight,
        uniforms.nearClip, uniforms.farClip, opacity, uniforms.minPixelSize,
        uniforms.isOrtho
    );

    if (!proj.valid) {
        splatTileCounts[threadIdx] = 0u;
        return;
    }

    let det = proj.a * proj.c - proj.b * proj.b;
    let invDet = 1.0 / det;
    let coeffX = -2.0 * proj.c * invDet;
    let coeffY = -2.0 * proj.a * invDet;
    let coeffXY = 4.0 * proj.b * invDet;

    let color = getColor();
    var rgb = prepareOutputFromGamma(max(color, vec3f(0.0)));

    let colorHalf = vec4<f16>(half(rgb.x), half(rgb.y), half(rgb.z), half(opacity));

    let base = threadIdx * CACHE_STRIDE;
    projCache[base + 0u] = bitcast<u32>(proj.screen.x);
    projCache[base + 1u] = bitcast<u32>(proj.screen.y);
    projCache[base + 2u] = bitcast<u32>(coeffX);
    projCache[base + 3u] = bitcast<u32>(coeffY);
    projCache[base + 4u] = bitcast<u32>(coeffXY);
    projCache[base + 5u] = pack2x16float(vec2f(f32(colorHalf.r), f32(colorHalf.g)));
    projCache[base + 6u] = pack2x16float(vec2f(f32(colorHalf.b), f32(colorHalf.a)));

    let eval = computeSplatTileEval(proj.screen, coeffX, coeffY, coeffXY, half(opacity),
                                    uniforms.viewportWidth, uniforms.viewportHeight);

    let minTileX = max(0i, i32(floor(eval.splatMin.x / f32(TILE_SIZE))));
    let maxTileX = min(i32(uniforms.numTilesX) - 1i, i32(floor(eval.splatMax.x / f32(TILE_SIZE))));
    let minTileY = max(0i, i32(floor(eval.splatMin.y / f32(TILE_SIZE))));
    let maxTileY = min(i32(uniforms.numTilesY) - 1i, i32(floor(eval.splatMax.y / f32(TILE_SIZE))));

    var count = 0u;
    for (var ty = minTileY; ty <= maxTileY; ty++) {
        for (var tx = minTileX; tx <= maxTileX; tx++) {
            let tMin = vec2f(f32(tx) * f32(TILE_SIZE), f32(ty) * f32(TILE_SIZE));
            let tMax = tMin + vec2f(f32(TILE_SIZE));
            if (tileIntersectsEllipse(tMin, tMax, proj.screen, coeffX, coeffY, coeffXY, eval.radiusFactor)) {
                count++;
            }
        }
    }
    splatTileCounts[threadIdx] = count;
}
`;
