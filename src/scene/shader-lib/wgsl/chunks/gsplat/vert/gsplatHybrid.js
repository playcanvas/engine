// Vertex shader for the hybrid GSplat renderer.
//
// Reads pre-projected splat data from a projection cache built by the projector
// compute pass (see compute-gsplat-projector.js) plus a globally sorted index
// list (radix sort). For each instanced quad vertex it expands the splat to a
// screen-aligned quad using the cached eigen-vectors v1, v2.
//
// The fragment shader is the existing gsplatPS — this chunk only replaces the
// vertex side of the existing rasterization path.
//
// Layout matches gsplat-projector-constants.js (CACHE_STRIDE = 8 u32 / 32 B):
//   [0..3] proj.xyzw  (clip-space center; .w is the real homogeneous w)
//   [4]    v1.xy      (pack2x16float)  — screen-pixel eigen-vectors
//   [5]    v2.xy      (pack2x16float)
//   [6]    color rg   (or pcId in pick mode)
//   [7]    color b + a (pack2x16float)
//
// Linear view depth (used for fog / overdraw / prepass) is reconstructed from
// clipPos via the clipToViewZ uniform = -inverse(matrix_projection)[row 2].
// This is correct for both perspective and orthographic projections; for
// perspective it collapses to clip.w, matching the previous behaviour exactly.
export default /* wgsl */`

#include "gsplatHelpersVS"
#include "gsplatOutputVS"

attribute vertex_position: vec3f;

uniform viewport_size: vec4f;

// -inverse(matrix_projection)[row 2]; lets the VS reconstruct linear view
// depth from clipPos via dot(clipToViewZ, clip). Set per-camera by the
// renderer (see GSplatHybridRenderer).
uniform clipToViewZ: vec4f;

// Globally sorted indices into projCache (output of the radix sort).
var<storage, read> sortedIndices: array<u32>;

// Pre-projected splat cache (8 u32 slots per splat).
var<storage, read> projCache: array<u32>;

// Visible splat count written by compute-gsplat-projector-write-indirect-args.js.
var<storage, read> numSplatsStorage: array<u32>;

varying gaussianUV: half2;
varying gaussianColor: half4;

#ifndef DITHER_NONE
    varying id: f32;
#endif

#ifdef PREPASS_PASS
    varying vLinearDepth: f32;
#endif

#if defined(GSPLAT_UNIFIED_ID) && defined(PICK_PASS)
    varying @interpolate(flat) vPickId: u32;
#endif

#ifdef GSPLAT_OVERDRAW
    uniform colorRampIntensity: f32;
    var colorRamp: texture_2d<f32>;
    var colorRampSampler: sampler;
#endif

const discardVec: vec4f = vec4f(0.0, 0.0, 2.0, 1.0);

@vertex
fn vertexMain(input: VertexInput) -> VertexOutput {
    var output: VertexOutput;

    // Same instance/quad linearisation as gsplatSourceVS:
    // order = instanceIdx * GSPLAT_INSTANCE_SIZE + perInstanceQuadIdx.
    let order = pcInstanceIndex * {GSPLAT_INSTANCE_SIZE}u + u32(vertex_position.z);

    let numSplats = numSplatsStorage[0];
    if (order >= numSplats) {
        output.position = discardVec;
        return output;
    }

    let cacheIdx = sortedIndices[order];
    let base = cacheIdx * {CACHE_STRIDE}u;

    let proj = vec4f(
        bitcast<f32>(projCache[base + 0u]),
        bitcast<f32>(projCache[base + 1u]),
        bitcast<f32>(projCache[base + 2u]),
        bitcast<f32>(projCache[base + 3u])
    );
    let v1 = unpack2x16float(projCache[base + 4u]);
    let v2 = unpack2x16float(projCache[base + 5u]);

    // Color / opacity / pickId: slot 6 is either packed (rg) or a raw u32 pcId.
    let ba = unpack2x16float(projCache[base + 7u]);
    let alpha = half(ba.y);

    #if defined(GSPLAT_UNIFIED_ID) && defined(PICK_PASS)
        let pickId = projCache[base + 6u];
    #endif

    #ifdef PICK_PASS
        // In the pick path slot 6 is repurposed as the picking ID; alpha is the only
        // colour we care about in the FS gate. Slot 7's r channel is unused.
        var clr: half4 = half4(half(0.0), half(0.0), half(0.0), alpha);
    #else
        let rg = unpack2x16float(projCache[base + 6u]);
        var clr: half4 = half4(half(rg.x), half(rg.y), half(ba.x), alpha);
    #endif

    // clipCorner: shrink the quad to exclude near-zero alpha regions. Mirrors the
    // helper in gsplatCommonVS (kept inline to avoid pulling in the full gsplatCommonVS).
    let cornerUV = vec2f(vertex_position.xy);
    let clip = min(half(1.0), sqrt(log(half(255.0) * alpha)) * half(0.5));
    let cornerClipped = cornerUV * f32(clip);

    // Convert pixel-space offset into clip-space. proj.w is the real clipPos.w,
    // so c == clip.w / viewport matches gsplatCorner.js line 97 for both
    // perspective (w == -view.z) and orthographic (w == 1) projections.
    let c = vec2f(proj.w) * uniform.viewport_size.zw;
    let pixelOffset = cornerClipped.x * v1 + cornerClipped.y * v2;
    let clipOffset = pixelOffset * c;

    output.position = proj + vec4f(clipOffset, 0.0, 0.0);
    output.gaussianUV = half2(cornerClipped);

    // Reconstruct linear view depth from clip via the per-camera clipToViewZ
    // uniform = -inverse(matrix_projection)[row 2]. For perspective this
    // collapses to clip.w; for ortho it produces the correct -view.z. Used by
    // fog/overdraw/prepass below.
    let viewDepth = dot(uniform.clipToViewZ, proj);

    #ifdef GSPLAT_OVERDRAW
        // Overdraw mode renders a flat colour ramp; depth-shade input not needed.
        let t: f32 = clamp(viewDepth / 20.0, 0.0, 1.0);
        let rampColor: vec3f = textureSampleLevel(colorRamp, colorRampSampler, vec2f(t, 0.5), 0.0).rgb;
        let outAlpha = alpha * half(1.0 / 32.0) * half(uniform.colorRampIntensity);
        output.gaussianColor = half4(half3(rampColor), outAlpha);
    #else
        output.gaussianColor = half4(
            half3(prepareOutputFromGamma(max(vec3f(clr.xyz), vec3f(0.0)), viewDepth)),
            alpha
        );
    #endif

    #ifndef DITHER_NONE
        // Best-effort id from the cache index — used only for blue-noise dither.
        output.id = f32(cacheIdx);
    #endif

    #ifdef PREPASS_PASS
        output.vLinearDepth = viewDepth;
    #endif

    #if defined(GSPLAT_UNIFIED_ID) && defined(PICK_PASS)
        output.vPickId = pickId;
    #endif

    return output;
}
`;
