// Tile rasterizer for the local compute renderer. One workgroup per tile, reads
// per-tile entry ranges from the prefix sum buffer and splat data from the projection cache.
//
// Each batch loads 64 splats into shared memory (1 per thread), then all 64 threads
// evaluate them against their 2×2 pixel quads. Per-thread early-out skips evaluation
// once all 4 pixels saturate; no workgroup-level early-out is used because WGSL lacks
// a fused barrier+vote intrinsic (like CUDA's __syncthreads_count), and emulating it
// with atomics+barriers costs more than the wasted branchless ALU on saturated pixels.
export const computeGsplatLocalRasterizeSource = /* wgsl */`

#include "halfTypesCS"
#ifndef PICK_MODE
    #include "decodePS"
    #if FOG != NONE
        #include "fogMathPS"
        #include "gammaPS"
    #endif
#endif

const BATCH_SIZE: u32 = 64u;
const ALPHA_THRESHOLD: half = half(1.0) / half(255.0);
const EXP4: half = exp(half(-4.0));
const INV_EXP4: half = half(1.0) / (half(1.0) - EXP4);

// Shared uniforms and storage buffers (same layout for both color and pick modes).
// Pick-only uniforms (nearClip, farClip, alphaClip) are present but unused in color mode.
struct Uniforms {
    screenWidth: u32,
    screenHeight: u32,
    numTilesX: u32,
    nearClip: f32,
    farClip: f32,
    alphaClip: f32,
    #if FOG != NONE
        fog_color: vec3f,
        fog_start: f32,
        fog_end: f32,
        fog_density: f32,
    #endif
}
@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var<storage, read> tileEntries: array<u32>;
@group(0) @binding(2) var<storage, read> tileSplatCounts: array<u32>;
@group(0) @binding(3) var<storage, read> projCache: array<u32>;
@group(0) @binding(4) var<storage, read> rasterizeTileList: array<u32>;
@group(0) @binding(5) var<storage, read> tileListCounts: array<u32>;
@group(0) @binding(6) var<storage, read> depthBuffer: array<u32>;

// Mode-specific output textures appended after the shared bindings.
#ifdef PICK_MODE
    @group(0) @binding(7) var pickIdTexture: texture_storage_2d<r32uint, write>;
    @group(0) @binding(8) var pickDepthTexture: texture_storage_2d<rgba16float, write>;
#else
    @group(0) @binding(7) var outputTexture: texture_storage_2d<rgba16float, write>;
    #ifdef DEPTH_TEST
        @group(0) @binding(8) var sceneDepthMap: texture_2d<f32>;
    #endif
#endif

var<workgroup> sharedCenterScreen: array<vec2f, 64>;
var<workgroup> sharedCoeffs: array<vec3f, 64>;
// Per-splat Gaussian exponent cutoff: -radiusFactor / 2. Used to skip exp() and the
// blend chain for splats whose contribution at all 4 pixels of the quad is below alphaClip.
var<workgroup> sharedPowerCutoff: array<f32, 64>;
#ifdef HEATMAP_MODE
    var<workgroup> sharedHeatCount: atomic<u32>;
#endif

// Pick mode stores per-splat opacity, ID and depth; color mode stores packed RGBA.
// Depth test mode also needs per-splat view depth for occlusion against scene geometry.
#ifdef PICK_MODE
    var<workgroup> sharedOpacity: array<half, 64>;
    var<workgroup> sharedPickId: array<u32, 64>;
    var<workgroup> sharedViewDepth: array<f32, 64>;
#else
    var<workgroup> sharedColor: array<half4, 64>;
    #ifdef DEPTH_TEST
        var<workgroup> sharedViewDepth: array<f32, 64>;
    #endif
#endif

// Evaluate a single splat for picking. Records the front-most pick ID (first splat above
// alphaClip) and accumulates alpha-weighted depth for sub-pixel depth reconstruction.
#ifdef PICK_MODE
fn evalSplatPick(pixelCoord: vec2f, center: vec2f, coeffX: f32, coeffY: f32, coeffXY: f32,
                 opacity: half, pickId: u32, viewDepth: f32, alphaClip: half,
                 bestPickId: ptr<function, u32>, depthAccum: ptr<function, f32>,
                 weightAccum: ptr<function, f32>, T: ptr<function, half>) {
    let dx = pixelCoord - center;
    let power = coeffX * dx.x * dx.x + coeffXY * dx.x * dx.y + coeffY * dx.y * dx.y;
    let gauss = (half(exp(power)) - EXP4) * INV_EXP4;
    let alpha = half(min(half(0.99), opacity * gauss));
    let newT = *T * (half(1.0) - alpha);
    let visible = power > -4.0 && alpha > ALPHA_THRESHOLD && *T >= ALPHA_THRESHOLD;
    if (!visible) { return; }

    // Per-pixel alphaClip: only solid splat centers contribute to pick
    if (alpha >= alphaClip) {
        if (*bestPickId == 0xFFFFFFFFu) {
            *bestPickId = pickId;
        }
        let normalizedDepth = saturate((viewDepth - uniforms.nearClip) / (uniforms.farClip - uniforms.nearClip));
        let w = f32(alpha) * f32(*T);
        *depthAccum += w * normalizedDepth;
        *weightAccum += w;
    }

    *T = newT;
}
#endif

#ifdef HEATMAP_MODE
fn heatmapColor(v: f32) -> vec3f {
    let t = saturate(v / 2000.0);
    if (t < 0.2) {
        return mix(vec3f(0.0, 0.0, 1.0), vec3f(0.0, 1.0, 1.0), t * 5.0);
    } else if (t < 0.4) {
        return mix(vec3f(0.0, 1.0, 1.0), vec3f(1.0, 1.0, 0.0), (t - 0.2) * 5.0);
    } else if (t < 0.6) {
        return mix(vec3f(1.0, 1.0, 0.0), vec3f(1.0, 0.0, 0.0), (t - 0.4) * 5.0);
    }
    return mix(vec3f(1.0, 0.0, 0.0), vec3f(0.15, 0.0, 0.0), (t - 0.6) * 2.5);
}
#endif

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

    // Per-pixel state for the 2x2 quad.

    #ifdef PICK_MODE
        var T00: half = half(1.0); var T10: half = half(1.0);
        var T01: half = half(1.0); var T11: half = half(1.0);

        // front-most pick ID per pixel
        var pickId00: u32 = 0xFFFFFFFFu; var pickId10: u32 = 0xFFFFFFFFu;
        var pickId01: u32 = 0xFFFFFFFFu; var pickId11: u32 = 0xFFFFFFFFu;

        // alpha-weighted depth accumulators
        var dAcc00: f32 = 0.0; var dAcc10: f32 = 0.0;
        var dAcc01: f32 = 0.0; var dAcc11: f32 = 0.0;

        // alpha-weighted weight accumulators
        var wAcc00: f32 = 0.0; var wAcc10: f32 = 0.0;
        var wAcc01: f32 = 0.0; var wAcc11: f32 = 0.0;
        let clipH = half(uniforms.alphaClip);
    #else
        // Transmittance for the 2x2 quad packed as vec4<half> (x=00, y=10, z=01, w=11).
        // Tracking how much light passes through the splat stack at that pixel. Packing
        // them into a single vec4 lets the compiler use vector ALU for the branchless
        // alpha-blending update and the all-saturated early-out test.
        var T = half4(1.0);

        // accumulated color per pixel
        var c00 = half3(0.0); var c10 = half3(0.0);
        var c01 = half3(0.0); var c11 = half3(0.0);

        #ifdef DEPTH_TEST
            // Load per-pixel linear scene depth for the 2x2 quad (x=00, y=10, z=01, w=11).
            // Splats behind this depth are skipped during rasterization.
            var sceneDepth = vec4f(1e20);
            let depthY0 = uniforms.screenHeight - 1u - basePixel.y;
            let depthY1 = depthY0 - 1u;
            if (basePixel.x < uniforms.screenWidth && basePixel.y < uniforms.screenHeight) {
                sceneDepth.x = textureLoad(sceneDepthMap, vec2i(vec2u(basePixel.x, depthY0)), 0).r;
            }
            if (basePixel.x + 1u < uniforms.screenWidth && basePixel.y < uniforms.screenHeight) {
                sceneDepth.y = textureLoad(sceneDepthMap, vec2i(vec2u(basePixel.x + 1u, depthY0)), 0).r;
            }
            if (basePixel.x < uniforms.screenWidth && basePixel.y + 1u < uniforms.screenHeight) {
                sceneDepth.z = textureLoad(sceneDepthMap, vec2i(vec2u(basePixel.x, depthY1)), 0).r;
            }
            if (basePixel.x + 1u < uniforms.screenWidth && basePixel.y + 1u < uniforms.screenHeight) {
                sceneDepth.w = textureLoad(sceneDepthMap, vec2i(vec2u(basePixel.x + 1u, depthY1)), 0).r;
            }
        #endif
    #endif

    let tileCount = tEnd - tStart;

    #ifdef HEATMAP_MODE
        if (localIdx == 0u) { atomicStore(&sharedHeatCount, 0u); }
        workgroupBarrier();
        var processedCount: u32 = 0u;
    #endif

    let numBatches = (tileCount + BATCH_SIZE - 1u) / BATCH_SIZE;
    var threadDone = false;

    for (var batch: u32 = 0u; batch < numBatches; batch++) {

        let batchOffset = batch * BATCH_SIZE + localIdx;
        if (batchOffset < tileCount) {
            let cacheIdx = tileEntries[tStart + batchOffset];
            let base = cacheIdx * {CACHE_STRIDE}u;
            sharedCenterScreen[localIdx] = vec2f(
                bitcast<f32>(projCache[base + 0u]),
                bitcast<f32>(projCache[base + 1u])
            );
            // Conic values cx/cy/cz stored as f32; convert to evaluation coefficients.
            let cx = bitcast<f32>(projCache[base + 2u]);
            let cy = bitcast<f32>(projCache[base + 3u]);
            let cz = bitcast<f32>(projCache[base + 4u]);
            sharedCoeffs[localIdx] = vec3f(cx * -0.5, cz * -0.5, -cy);
            sharedPowerCutoff[localIdx] = bitcast<f32>(projCache[base + 7u]);

            #ifdef PICK_MODE
                sharedPickId[localIdx] = projCache[base + 5u];
                sharedOpacity[localIdx] = half(unpack2x16float(projCache[base + 6u]).y);
                sharedViewDepth[localIdx] = bitcast<f32>(depthBuffer[cacheIdx]);
            #else
                let rg = unpack2x16float(projCache[base + 5u]);
                let ba = unpack2x16float(projCache[base + 6u]);

                #if FOG != NONE
                    let viewDepth = bitcast<f32>(depthBuffer[cacheIdx]);
                    #if (FOG == LINEAR)
                        let fogFactor = evaluateFogFactorLinear(viewDepth, uniforms.fog_start, uniforms.fog_end);
                    #elif (FOG == EXP)
                        let fogFactor = evaluateFogFactorExp(viewDepth, uniforms.fog_density);
                    #elif (FOG == EXP2)
                        let fogFactor = evaluateFogFactorExp2(viewDepth, uniforms.fog_density);
                    #endif
                    var foggedColor = decodeGamma3(vec3f(rg.x, rg.y, ba.x));
                    foggedColor = mix(uniforms.fog_color, foggedColor, fogFactor);
                    sharedColor[localIdx] = half4(half3(gammaCorrectOutput(foggedColor)), half(ba.y));
                #else
                    sharedColor[localIdx] = half4(half(rg.x), half(rg.y), half(ba.x), half(ba.y));
                #endif

                #ifdef DEPTH_TEST
                    sharedViewDepth[localIdx] = bitcast<f32>(depthBuffer[cacheIdx]);
                #endif
            #endif
        }

        workgroupBarrier();

        if (!threadDone) {
            let batchCount = min(BATCH_SIZE, tileCount - batch * BATCH_SIZE);

            for (var i: u32 = 0u; i < batchCount; i++) {
                let center = sharedCenterScreen[i];
                let coeffs = sharedCoeffs[i];

                #ifdef PICK_MODE
                    let splatOpacity = sharedOpacity[i];
                    let splatPickId = sharedPickId[i];
                    let splatDepth = sharedViewDepth[i];

                    // Skip the 4 per-pixel pick evaluations entirely when the splat
                    // contributes nothing to any pixel in this quad.
                    let d = p00 - center;
                    let dxV = vec4f(d.x, d.x + 1.0, d.x, d.x + 1.0);
                    let dyV = vec4f(d.y, d.y, d.y + 1.0, d.y + 1.0);
                    let power4 = coeffs.x * dxV * dxV + coeffs.z * dxV * dyV + coeffs.y * dyV * dyV;
                    if (all(power4 <= vec4f(sharedPowerCutoff[i]))) {
                        continue;
                    }

                    evalSplatPick(p00, center, coeffs.x, coeffs.y, coeffs.z, splatOpacity, splatPickId, splatDepth, clipH, &pickId00, &dAcc00, &wAcc00, &T00);
                    evalSplatPick(p10, center, coeffs.x, coeffs.y, coeffs.z, splatOpacity, splatPickId, splatDepth, clipH, &pickId10, &dAcc10, &wAcc10, &T10);
                    evalSplatPick(p01, center, coeffs.x, coeffs.y, coeffs.z, splatOpacity, splatPickId, splatDepth, clipH, &pickId01, &dAcc01, &wAcc01, &T01);
                    evalSplatPick(p11, center, coeffs.x, coeffs.y, coeffs.z, splatOpacity, splatPickId, splatDepth, clipH, &pickId11, &dAcc11, &wAcc11, &T11);

                    if (all(vec4<half>(T00, T10, T01, T11) < half4(ALPHA_THRESHOLD))) {
                        threadDone = true;
                        break;
                    }
                #else
                    let splatColor = sharedColor[i];

                    #ifdef DEPTH_TEST
                        let splatDepth = sharedViewDepth[i];

                        // Splats are front-to-back; if behind all four depth samples, all remaining splats will be too.
                        if (all(vec4f(splatDepth) > sceneDepth)) {
                            threadDone = true;
                            break;
                        }
                    #endif

                    // Vectorized Gaussian evaluation for the 2x2 pixel quad. Compute dx
                    // once from p00, build the four pixel offsets as vec4f (exploiting the
                    // regular +1 grid), and evaluate power/gauss/alpha/transmittance as
                    // vec4 operations to share ALU across the quad.
                    let d = p00 - center;
                    let dxV = vec4f(d.x, d.x + 1.0, d.x, d.x + 1.0);
                    let dyV = vec4f(d.y, d.y, d.y + 1.0, d.y + 1.0);
                    let power4 = coeffs.x * dxV * dxV + coeffs.z * dxV * dyV + coeffs.y * dyV * dyV;

                    // Skip exp() and the blend chain when the splat contributes nothing
                    // at any of the 4 pixels. The per-splat cutoff is tighter than -4 for
                    // low-opacity splats, so they drop earlier.
                    if (all(power4 <= vec4f(sharedPowerCutoff[i]))) {
                        continue;
                    }

                    let gauss4 = (half4(exp(power4)) - half4(EXP4)) * half4(INV_EXP4);
                    let alpha4 = min(half4(0.99), half4(splatColor.a) * gauss4);
                    let newT = T * (half4(1.0) - alpha4);

                    var valid = (power4 > vec4f(-4.0)) & (alpha4 > half4(ALPHA_THRESHOLD)) & (T >= half4(ALPHA_THRESHOLD));
                    #ifdef DEPTH_TEST
                        valid = valid & (vec4f(splatDepth) <= sceneDepth);
                    #endif

                    let weight = alpha4 * T * select(half4(0.0), half4(1.0), valid);
                    c00 += splatColor.rgb * weight.x;
                    c10 += splatColor.rgb * weight.y;
                    c01 += splatColor.rgb * weight.z;
                    c11 += splatColor.rgb * weight.w;
                    T = select(T, newT, valid);

                    #ifdef HEATMAP_MODE
                        processedCount += 1u;
                    #endif

                    if (all(T < half4(ALPHA_THRESHOLD))) {
                        threadDone = true;
                        break;
                    }
                #endif
            }
        }

        workgroupBarrier();
    }

    #ifdef HEATMAP_MODE
        atomicAdd(&sharedHeatCount, processedCount);
        workgroupBarrier();
        let avgCount = f32(atomicLoad(&sharedHeatCount)) / 64.0;
        let heatColor = vec4f(heatmapColor(avgCount), 1.0);
        if (basePixel.x < uniforms.screenWidth && basePixel.y < uniforms.screenHeight) {
            textureStore(outputTexture, basePixel, heatColor);
        }
        if (basePixel.x + 1u < uniforms.screenWidth && basePixel.y < uniforms.screenHeight) {
            textureStore(outputTexture, vec2u(basePixel.x + 1u, basePixel.y), heatColor);
        }
        if (basePixel.x < uniforms.screenWidth && basePixel.y + 1u < uniforms.screenHeight) {
            textureStore(outputTexture, vec2u(basePixel.x, basePixel.y + 1u), heatColor);
        }
        if (basePixel.x + 1u < uniforms.screenWidth && basePixel.y + 1u < uniforms.screenHeight) {
            textureStore(outputTexture, vec2u(basePixel.x + 1u, basePixel.y + 1u), heatColor);
        }
    #else

        // Write results for the 2x2 pixel quad owned by this thread.
        // Pick mode: store the front-most pick ID and (accumulated depth, weight) per pixel.
        // Color mode: convert accumulated gamma-space color to linear via decodeGamma3 and store
        // to the rgba16float output texture; alpha holds total opacity (1 - transmittance).
        if (basePixel.x < uniforms.screenWidth && basePixel.y < uniforms.screenHeight) {
            #ifdef PICK_MODE
                textureStore(pickIdTexture, basePixel, vec4u(pickId00, 0u, 0u, 0u));
                textureStore(pickDepthTexture, basePixel, vec4f(dAcc00, wAcc00, 0.0, 0.0));
            #else
                textureStore(outputTexture, basePixel, vec4f(decodeGamma3(vec3f(c00)), f32(half(1.0) - T.x)));
            #endif
        }
        if (basePixel.x + 1u < uniforms.screenWidth && basePixel.y < uniforms.screenHeight) {
            let px10 = vec2u(basePixel.x + 1u, basePixel.y);
            #ifdef PICK_MODE
                textureStore(pickIdTexture, px10, vec4u(pickId10, 0u, 0u, 0u));
                textureStore(pickDepthTexture, px10, vec4f(dAcc10, wAcc10, 0.0, 0.0));
            #else
                textureStore(outputTexture, px10, vec4f(decodeGamma3(vec3f(c10)), f32(half(1.0) - T.y)));
            #endif
        }
        if (basePixel.x < uniforms.screenWidth && basePixel.y + 1u < uniforms.screenHeight) {
            let px01 = vec2u(basePixel.x, basePixel.y + 1u);
            #ifdef PICK_MODE
                textureStore(pickIdTexture, px01, vec4u(pickId01, 0u, 0u, 0u));
                textureStore(pickDepthTexture, px01, vec4f(dAcc01, wAcc01, 0.0, 0.0));
            #else
                textureStore(outputTexture, px01, vec4f(decodeGamma3(vec3f(c01)), f32(half(1.0) - T.z)));
            #endif
        }
        if (basePixel.x + 1u < uniforms.screenWidth && basePixel.y + 1u < uniforms.screenHeight) {
            let px11 = vec2u(basePixel.x + 1u, basePixel.y + 1u);
            #ifdef PICK_MODE
                textureStore(pickIdTexture, px11, vec4u(pickId11, 0u, 0u, 0u));
                textureStore(pickDepthTexture, px11, vec4f(dAcc11, wAcc11, 0.0, 0.0));
            #else
                textureStore(outputTexture, px11, vec4f(decodeGamma3(vec3f(c11)), f32(half(1.0) - T.w)));
            #endif
        }

    #endif
}
`;
