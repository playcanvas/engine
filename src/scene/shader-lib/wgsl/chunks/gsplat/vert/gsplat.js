export default /* wgsl */`
#include "gsplatCommonVS"

varying gaussianUV: half2;
varying gaussianColor: half4;

#ifndef DITHER_NONE
    varying id: f32;
#endif

const discardVec: vec4f = vec4f(0.0, 0.0, 2.0, 1.0);

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

@vertex
fn vertexMain(input: VertexInput) -> VertexOutput {
    var output: VertexOutput;

    // read gaussian details
    var source: SplatSource;
    if (!initSource(&source)) {
        output.position = discardVec;
        return output;
    }

    var modelCenter: vec3f = getCenter();

    var center: SplatCenter;
    center.modelCenterOriginal = modelCenter;
    
    modifySplatCenter(&modelCenter);
    center.modelCenterModified = modelCenter;

    if (!initCenter(modelCenter, &center)) {
        output.position = discardVec;
        return output;
    }

    // project center to screen space
    var corner: SplatCorner;
    if (!initCorner(&source, &center, &corner)) {
        output.position = discardVec;
        return output;
    }

    // read color (~11 bit source data, use half precision)
    var clr: half4 = half4(getColor());

    #if GSPLAT_AA
        clr.a = clr.a * corner.aaFactor;
    #endif

    // evaluate spherical harmonics
    #if SH_BANDS > 0
        // calculate the model-space view direction
        let modelView3x3 = mat3x3f(center.modelView[0].xyz, center.modelView[1].xyz, center.modelView[2].xyz);
        let dir = normalize(center.view * modelView3x3);

        // read sh coefficients
        var sh: array<half3, SH_COEFFS>;
        var scale: f32;
        readSHData(&sh, &scale);

        // evaluate (SH coefficients and result are half precision)
        clr = half4(clr.xyz + evalSH(&sh, dir) * half(scale), clr.a);
    #endif

    // user hook operates in f32
    var clrF32 = vec4f(clr);
    modifySplatColor(modelCenter, &clrF32);
    clr = half4(clrF32);

    clipCorner(&corner, f32(clr.w));

    // write output
    #if GSPLAT_2DGS
        // 2DGS: Project world corner directly
        let modelCorner: vec3f = center.modelCenterModified + corner.offset;
        output.position = uniform.matrix_projection * center.modelView * vec4f(modelCorner, 1.0);
    #else
        // 3DGS: Add clip-space offset to projected center
        output.position = center.proj + vec4f(corner.offset.xyz, 0.0);
    #endif
    output.gaussianUV = corner.uv;

    #ifdef GSPLAT_OVERDRAW
        // Overdraw visualization mode: color by elevation
        let t: f32 = clamp(modelCenter.y / 20.0, 0.0, 1.0);
        let rampColor: vec3f = textureSampleLevel(colorRamp, colorRampSampler, vec2f(t, 0.5), 0.0).rgb;
        clr.a = clr.a * half(1.0 / 32.0) * half(uniform.colorRampIntensity);
        output.gaussianColor = half4(half3(rampColor), clr.a);
    #else
        output.gaussianColor = half4(half3(prepareOutputFromGamma(max(vec3f(clr.xyz), vec3f(0.0)))), clr.w);
    #endif

    #ifndef DITHER_NONE
        output.id = f32(splat.index);
    #endif

    #ifdef PREPASS_PASS
        output.vLinearDepth = -center.view.z;
    #endif

    #if defined(GSPLAT_UNIFIED_ID) && defined(PICK_PASS)
        output.vPickId = loadPcId().r;
    #endif

    return output;
}
`;
