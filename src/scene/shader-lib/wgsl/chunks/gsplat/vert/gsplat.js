export default /* wgsl */`
#include "gsplatCommonVS"

varying gaussianUV: vec2f;
varying gaussianColor: vec4f;

#ifndef DITHER_NONE
    varying id: f32;
#endif

const discardVec: vec4f = vec4f(0.0, 0.0, 2.0, 1.0);

#ifdef PREPASS_PASS
    varying vLinearDepth: f32;
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

    #ifdef GSPLAT_WORKBUFFER_DATA
        loadSplatTextures(&source);
    #endif

    let modelCenter: vec3f = readCenter(&source);

    var center: SplatCenter;
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

    // read color
    var clr: vec4f = readColor(&source);

    #if GSPLAT_AA
        // apply AA compensation
        clr.a = clr.a * corner.aaFactor;
    #endif

    // evaluate spherical harmonics
    #if SH_BANDS > 0
        // calculate the model-space view direction
        let modelView3x3 = mat3x3f(center.modelView[0].xyz, center.modelView[1].xyz, center.modelView[2].xyz);
        let dir = normalize(center.view * modelView3x3);

        // read sh coefficients
        var sh: array<vec3f, SH_COEFFS>;
        var scale: f32;
        readSHData(&source, &sh, &scale);

        // evaluate
        clr = vec4f(clr.xyz + evalSH(&sh, dir) * scale, clr.a);
    #endif

    clipCorner(&corner, clr.w);

    // write output
    output.position = center.proj + vec4f(corner.offset, 0.0, 0.0);
    output.gaussianUV = corner.uv;
    output.gaussianColor = vec4f(prepareOutputFromGamma(max(clr.xyz, vec3f(0.0))), clr.w);

    #ifndef DITHER_NONE
        output.id = f32(source.id);
    #endif

    #ifdef PREPASS_PASS
        output.vLinearDepth = -center.view.z;
    #endif

    return output;
}
`;
