// Per-splat projection + projection cache write + atomic per-tile counting.
// Each thread processes one visible splat from the compacted ID list.
export const computeGsplatLocalTileCountSource = /* wgsl */`

#include "gsplatCommonCS"
#include "gsplatTileIntersectCS"

const CACHE_STRIDE: u32 = 8u;

@group(0) @binding(0) var<storage, read> compactedSplatIds: array<u32>;
@group(0) @binding(1) var<storage, read> sortElementCount: array<u32>;
@group(0) @binding(2) var dataTransformA: texture_2d<u32>;
@group(0) @binding(3) var dataTransformB: texture_2d<u32>;
@group(0) @binding(4) var dataColor: texture_2d<u32>;
@group(0) @binding(5) var<storage, read_write> projCache: array<u32>;
@group(0) @binding(6) var<storage, read_write> tileSplatCounts: array<atomic<u32>>;

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
}
@group(0) @binding(7) var<uniform> uniforms: Uniforms;

@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) gid: vec3u, @builtin(num_workgroups) numWorkgroups: vec3u) {
    let threadIdx = gid.y * (numWorkgroups.x * 256u) + gid.x;
    let numVisible = sortElementCount[0];
    if (threadIdx >= numVisible) {
        return;
    }

    let splatId = compactedSplatIds[threadIdx];
    let texSize = uniforms.splatTextureSize;
    let uv = vec2i(i32(splatId % texSize), i32(splatId / texSize));

    let tA = textureLoad(dataTransformA, uv, 0);
    let tB = textureLoad(dataTransformB, uv, 0).x;

    let worldCenter = vec3f(bitcast<f32>(tA.r), bitcast<f32>(tA.g), bitcast<f32>(tA.b));
    let rotation = decodeRotation(tA.a);
    let scale = decodeScale(tB);
    let opacity = f32(tB >> 24u) / 255.0;

    if (opacity < 1.0 / 255.0) {
        projCache[threadIdx * CACHE_STRIDE + 6u] = 0u;
        return;
    }

    let proj = computeSplatCov(
        worldCenter, rotation, scale,
        uniforms.viewMatrix, uniforms.viewProj,
        uniforms.focal, uniforms.viewportWidth, uniforms.viewportHeight,
        uniforms.nearClip, uniforms.farClip, opacity, uniforms.minPixelSize,
        uniforms.isOrtho
    );

    if (!proj.valid) {
        projCache[threadIdx * CACHE_STRIDE + 6u] = 0u;
        return;
    }

    let det = proj.a * proj.c - proj.b * proj.b;
    let invDet = 1.0 / det;
    let coeffX = -0.5 * proj.c * invDet;
    let coeffY = -0.5 * proj.a * invDet;
    let coeffXY = proj.b * invDet;

    let tC = textureLoad(dataColor, uv, 0).x;
    let rgb = decodeColor(tC);

    let base = threadIdx * CACHE_STRIDE;
    projCache[base + 0u] = bitcast<u32>(proj.screen.x);
    projCache[base + 1u] = bitcast<u32>(proj.screen.y);
    projCache[base + 2u] = bitcast<u32>(coeffX);
    projCache[base + 3u] = bitcast<u32>(coeffY);
    projCache[base + 4u] = bitcast<u32>(coeffXY);
    projCache[base + 5u] = pack2x16float(vec2f(rgb.x, rgb.y));
    projCache[base + 6u] = pack2x16float(vec2f(rgb.z, opacity));

    let viewDepth = -(uniforms.viewMatrix * vec4f(worldCenter, 1.0)).z;
    projCache[base + 7u] = bitcast<u32>(viewDepth);

    let splatMin = proj.screen - proj.radius;
    let splatMax = proj.screen + proj.radius;

    let minTileX = max(0i, i32(floor(splatMin.x / f32(TILE_SIZE))));
    let maxTileX = min(i32(uniforms.numTilesX) - 1i, i32(floor(splatMax.x / f32(TILE_SIZE))));
    let minTileY = max(0i, i32(floor(splatMin.y / f32(TILE_SIZE))));
    let maxTileY = min(i32(uniforms.numTilesY) - 1i, i32(floor(splatMax.y / f32(TILE_SIZE))));

    for (var ty = minTileY; ty <= maxTileY; ty++) {
        for (var tx = minTileX; tx <= maxTileX; tx++) {
            let tMin = vec2f(f32(tx) * f32(TILE_SIZE), f32(ty) * f32(TILE_SIZE));
            let tMax = tMin + vec2f(f32(TILE_SIZE));
            if (tileIntersectsEllipse(tMin, tMax, proj.screen, coeffX, coeffY, coeffXY, proj.radiusFactor)) {
                let tileIdx = u32(ty) * uniforms.numTilesX + u32(tx);
                atomicAdd(&tileSplatCounts[tileIdx], 1u);
            }
        }
    }
}
`;
