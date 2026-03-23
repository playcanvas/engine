// Tile rasterizer for the local compute renderer. One workgroup per tile, reads
// per-tile entry ranges from the prefix sum buffer and splat data from the projection cache.
// Nearly identical to the global rasterizer but uses prefix-sum offsets instead of paired ranges.
export const computeGsplatLocalRasterizeSource = /* wgsl */`

#include "halfTypesCS"

const CACHE_STRIDE: u32 = 8u;
const BATCH_SIZE: u32 = 64u;
const WORKGROUP_SIZE: u32 = 64u;
const ALPHA_THRESHOLD: half = half(1.0) / half(255.0);
const EXP4: half = exp(half(-4.0));
const INV_EXP4: half = half(1.0) / (half(1.0) - EXP4);

@group(0) @binding(0) var outputTexture: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(1) var<storage, read> tileEntries: array<u32>;
@group(0) @binding(2) var<storage, read> tileSplatCounts: array<u32>;
@group(0) @binding(3) var<storage, read> projCache: array<u32>;
@group(0) @binding(4) var<storage, read> rasterizeTileList: array<u32>;
@group(0) @binding(5) var<storage, read> tileListCounts: array<u32>;

struct Uniforms {
    screenWidth: u32,
    screenHeight: u32,
    numTilesX: u32,
}
@group(0) @binding(6) var<uniform> uniforms: Uniforms;

var<workgroup> sharedCenterScreen: array<vec2f, 64>;
var<workgroup> sharedCoeffs: array<vec3f, 64>;
var<workgroup> sharedColor: array<half4, 64>;
var<workgroup> doneCount: atomic<u32>;

fn evalSplat(pixelCoord: vec2f, center: vec2f, coeffX: f32, coeffY: f32, coeffXY: f32, splatColor: half4, colorAccum: ptr<function, half3>, T: ptr<function, half>) {
    let dx = pixelCoord - center;
    let power = coeffX * dx.x * dx.x + coeffXY * dx.x * dx.y + coeffY * dx.y * dx.y;
    let gauss = (half(exp(power)) - EXP4) * INV_EXP4;
    let alpha = half(min(half(0.99), splatColor.a * gauss));
    let newT = *T * (half(1.0) - alpha);
    let cond = half(power > -4.0 && alpha > ALPHA_THRESHOLD && *T >= ALPHA_THRESHOLD);
    *colorAccum += splatColor.rgb * alpha * (*T) * cond;
    *T = cond * newT + (half(1.0) - cond) * (*T);
}

@compute @workgroup_size(8, 8)
fn main(
    @builtin(local_invocation_id) lid: vec3u,
    @builtin(local_invocation_index) localIdx: u32,
    @builtin(workgroup_id) wid: vec3u,
    @builtin(num_workgroups) numWorkgroups: vec3u
) {
    let workgroupIdx = wid.y * numWorkgroups.x + wid.x;
    if (workgroupIdx >= tileListCounts[2]) {
        return;
    }
    let tileIdx = rasterizeTileList[workgroupIdx];
    let tileX = tileIdx % uniforms.numTilesX;
    let tileY = tileIdx / uniforms.numTilesX;
    let tStart = tileSplatCounts[tileIdx];
    let tEnd = tileSplatCounts[tileIdx + 1u];

    let basePixel = vec2u(tileX * 16u + lid.x * 2u, tileY * 16u + lid.y * 2u);
    let p00 = vec2f(f32(basePixel.x) + 0.5, f32(basePixel.y) + 0.5);
    let p10 = p00 + vec2f(1.0, 0.0);
    let p01 = p00 + vec2f(0.0, 1.0);
    let p11 = p00 + vec2f(1.0, 1.0);

    var c00 = half3(0.0); var T00: half = half(1.0);
    var c10 = half3(0.0); var T10: half = half(1.0);
    var c01 = half3(0.0); var T01: half = half(1.0);
    var c11 = half3(0.0); var T11: half = half(1.0);

    let tileCount = tEnd - tStart;

    let numBatches = (tileCount + BATCH_SIZE - 1u) / BATCH_SIZE;
    var threadDone = false;

    for (var batch: u32 = 0u; batch < numBatches; batch++) {

        if (localIdx == 0u) {
            atomicStore(&doneCount, 0u);
        }

        let batchOffset = batch * BATCH_SIZE + localIdx;
        if (batchOffset < tileCount) {
            let cacheIdx = tileEntries[tStart + batchOffset];
            let base = cacheIdx * CACHE_STRIDE;
            sharedCenterScreen[localIdx] = vec2f(
                bitcast<f32>(projCache[base + 0u]),
                bitcast<f32>(projCache[base + 1u])
            );
            sharedCoeffs[localIdx] = vec3f(
                bitcast<f32>(projCache[base + 2u]),
                bitcast<f32>(projCache[base + 3u]),
                bitcast<f32>(projCache[base + 4u])
            );
            let rg = unpack2x16float(projCache[base + 5u]);
            let ba = unpack2x16float(projCache[base + 6u]);
            sharedColor[localIdx] = half4(half(rg.x), half(rg.y), half(ba.x), half(ba.y));
        }

        workgroupBarrier();

        if (!threadDone) {
            let batchCount = min(BATCH_SIZE, tileCount - batch * BATCH_SIZE);

            for (var i: u32 = 0u; i < batchCount; i++) {
                let center = sharedCenterScreen[i];
                let coeffs = sharedCoeffs[i];
                let splatColor = sharedColor[i];

                evalSplat(p00, center, coeffs.x, coeffs.y, coeffs.z, splatColor, &c00, &T00);
                evalSplat(p10, center, coeffs.x, coeffs.y, coeffs.z, splatColor, &c10, &T10);
                evalSplat(p01, center, coeffs.x, coeffs.y, coeffs.z, splatColor, &c01, &T01);
                evalSplat(p11, center, coeffs.x, coeffs.y, coeffs.z, splatColor, &c11, &T11);

                if (T00 < ALPHA_THRESHOLD && T10 < ALPHA_THRESHOLD && T01 < ALPHA_THRESHOLD && T11 < ALPHA_THRESHOLD) {
                    threadDone = true;
                    break;
                }
            }
        }

        if (threadDone) {
            atomicAdd(&doneCount, 1u);
        }
        let totalDone = workgroupUniformLoad(&doneCount);
        if (totalDone == WORKGROUP_SIZE) {
            break;
        }
    }

    if (basePixel.x < uniforms.screenWidth && basePixel.y < uniforms.screenHeight) {
        textureStore(outputTexture, basePixel, vec4f(vec3f(c00), f32(half(1.0) - T00)));
    }
    if (basePixel.x + 1u < uniforms.screenWidth && basePixel.y < uniforms.screenHeight) {
        textureStore(outputTexture, vec2u(basePixel.x + 1u, basePixel.y), vec4f(vec3f(c10), f32(half(1.0) - T10)));
    }
    if (basePixel.x < uniforms.screenWidth && basePixel.y + 1u < uniforms.screenHeight) {
        textureStore(outputTexture, vec2u(basePixel.x, basePixel.y + 1u), vec4f(vec3f(c01), f32(half(1.0) - T01)));
    }
    if (basePixel.x + 1u < uniforms.screenWidth && basePixel.y + 1u < uniforms.screenHeight) {
        textureStore(outputTexture, vec2u(basePixel.x + 1u, basePixel.y + 1u), vec4f(vec3f(c11), f32(half(1.0) - T11)));
    }
}
`;
