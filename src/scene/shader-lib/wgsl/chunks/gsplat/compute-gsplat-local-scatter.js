// Per-splat scatter: re-reads projection data from projCache, iterates overlapping tiles,
// and atomically writes the splat's cache index into per-tile entry lists.
export const computeGsplatLocalScatterSource = /* wgsl */`

#include "gsplatTileIntersectCS"

const TILE_SIZE: u32 = 16u;
const CACHE_STRIDE: u32 = 8u;

@group(0) @binding(0) var<storage, read> projCache: array<u32>;
@group(0) @binding(1) var<storage, read> sortElementCount: array<u32>;
@group(0) @binding(2) var<storage, read> tileSplatCounts: array<u32>;
@group(0) @binding(3) var<storage, read_write> tileWriteCursors: array<atomic<u32>>;
@group(0) @binding(4) var<storage, read_write> tileEntries: array<u32>;

struct Uniforms {
    numTilesX: u32,
    numTilesY: u32,
    maxEntries: u32,
    viewportWidth: f32,
    viewportHeight: f32,
}
@group(0) @binding(5) var<uniform> uniforms: Uniforms;

@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) gid: vec3u, @builtin(num_workgroups) numWorkgroups: vec3u) {
    let threadIdx = gid.y * (numWorkgroups.x * 256u) + gid.x;
    let numVisible = sortElementCount[0];
    if (threadIdx >= numVisible) {
        return;
    }

    let base = threadIdx * CACHE_STRIDE;
    let opacity = unpack2x16float(projCache[base + 6u]).y;
    if (opacity <= 0.0) {
        return;
    }

    let screenX = bitcast<f32>(projCache[base + 0u]);
    let screenY = bitcast<f32>(projCache[base + 1u]);
    let coeffX = bitcast<f32>(projCache[base + 2u]);
    let coeffY = bitcast<f32>(projCache[base + 3u]);
    let coeffXY = bitcast<f32>(projCache[base + 4u]);

    // Recover radius from coefficients (same logic as tile-expand shader)
    let K = 4.0 * coeffX * coeffY - coeffXY * coeffXY;
    let a = -8.0 * coeffY / K;
    let c = -8.0 * coeffX / K;
    let radiusFactor = min(8.0, 2.0 * log(255.0 * opacity));

    let vmin = min(1024.0, min(uniforms.viewportWidth, uniforms.viewportHeight));
    let radius = vec2f(min(sqrt(2.0 * a), 2.0 * vmin), min(sqrt(2.0 * c), 2.0 * vmin));
    let screen = vec2f(screenX, screenY);
    let splatMin = screen - radius;
    let splatMax = screen + radius;

    let minTileX = max(0i, i32(floor(splatMin.x / f32(TILE_SIZE))));
    let maxTileX = min(i32(uniforms.numTilesX) - 1i, i32(floor(splatMax.x / f32(TILE_SIZE))));
    let minTileY = max(0i, i32(floor(splatMin.y / f32(TILE_SIZE))));
    let maxTileY = min(i32(uniforms.numTilesY) - 1i, i32(floor(splatMax.y / f32(TILE_SIZE))));

    for (var ty = minTileY; ty <= maxTileY; ty++) {
        for (var tx = minTileX; tx <= maxTileX; tx++) {
            let tMin = vec2f(f32(tx) * f32(TILE_SIZE), f32(ty) * f32(TILE_SIZE));
            let tMax = tMin + vec2f(f32(TILE_SIZE));
            if (tileIntersectsEllipse(tMin, tMax, screen, coeffX, coeffY, coeffXY, radiusFactor)) {
                let tileIdx = u32(ty) * uniforms.numTilesX + u32(tx);
                let writePos = tileSplatCounts[tileIdx] + atomicAdd(&tileWriteCursors[tileIdx], 1u);
                // Bounds-check against the tile's allocated range, not just the buffer size.
                // The tile-count and scatter passes may disagree on borderline tile intersections
                // due to GPU compiler optimizations (e.g. FMA fusion) producing different results
                // for identical inputs across separate shader programs. Without this check,
                // overflow entries corrupt the adjacent tile's data in tileEntries.
                let tileEnd = tileSplatCounts[tileIdx + 1u];
                if (writePos < tileEnd && writePos < uniforms.maxEntries) {
                    tileEntries[writePos] = threadIdx;
                }
            }
        }
    }
}
`;
