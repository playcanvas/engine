export const computeGsplatTileExpandSource = /* wgsl */`

#include "halfTypesCS"
#include "gsplatTileIntersectCS"

const TILE_SIZE: u32 = 16u;
const CACHE_STRIDE: u32 = 7u;

@group(0) @binding(0) var<storage, read> splatOffsets: array<u32>;
@group(0) @binding(1) var<storage, read> projCache: array<u32>;
@group(0) @binding(2) var<storage, read_write> tileKeys: array<u32>;
@group(0) @binding(3) var<storage, read_write> tileSplatIds: array<u32>;

struct Uniforms {
    numSplats: u32,
    numTilesX: u32,
    numTilesY: u32,
    maxEntries: u32,
    viewportWidth: f32,
    viewportHeight: f32,
}
@group(0) @binding(4) var<uniform> uniforms: Uniforms;

@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) gid: vec3u, @builtin(num_workgroups) numWorkgroups: vec3u) {
    let threadIdx = gid.y * (numWorkgroups.x * 256u) + gid.x;
    if (threadIdx >= uniforms.numSplats) {
        return;
    }

    let offset = splatOffsets[threadIdx];
    let nextOffset = splatOffsets[threadIdx + 1u];
    if (offset >= nextOffset || offset >= uniforms.maxEntries) {
        return;
    }

    // Read screen position, precomputed coefficients, and opacity from the projection cache
    let base = threadIdx * CACHE_STRIDE;
    let screenX = bitcast<f32>(projCache[base + 0u]);
    let screenY = bitcast<f32>(projCache[base + 1u]);
    let coeffX = bitcast<f32>(projCache[base + 2u]);
    let coeffY = bitcast<f32>(projCache[base + 3u]);
    let coeffXY = bitcast<f32>(projCache[base + 4u]);
    let opacity = unpack2x16float(projCache[base + 6u]).y;

    let screen = vec2f(screenX, screenY);
    let eval = computeSplatTileEval(screen, coeffX, coeffY, coeffXY, half(opacity),
                                    uniforms.viewportWidth, uniforms.viewportHeight,
                                    1.0 / 255.0);

    let minTileX = max(0i, i32(floor(eval.splatMin.x / f32(TILE_SIZE))));
    let maxTileX = min(i32(uniforms.numTilesX) - 1i, i32(floor(eval.splatMax.x / f32(TILE_SIZE))));
    let minTileY = max(0i, i32(floor(eval.splatMin.y / f32(TILE_SIZE))));
    let maxTileY = min(i32(uniforms.numTilesY) - 1i, i32(floor(eval.splatMax.y / f32(TILE_SIZE))));

    var writeIdx = offset;
    for (var ty = minTileY; ty <= maxTileY; ty++) {
        for (var tx = minTileX; tx <= maxTileX; tx++) {
            if (writeIdx >= nextOffset || writeIdx >= uniforms.maxEntries) {
                return;
            }
            let tMin = vec2f(f32(tx) * f32(TILE_SIZE), f32(ty) * f32(TILE_SIZE));
            let tMax = tMin + vec2f(f32(TILE_SIZE));
            if (tileIntersectsEllipse(tMin, tMax, screen, coeffX, coeffY, coeffXY, eval.radiusFactor)) {
                let tileIdx = u32(ty) * uniforms.numTilesX + u32(tx);
                tileKeys[writeIdx] = tileIdx;
                tileSplatIds[writeIdx] = threadIdx;
                writeIdx++;
            }
        }
    }
}
`;
