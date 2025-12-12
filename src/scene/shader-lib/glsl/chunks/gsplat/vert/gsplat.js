export default /* glsl */`
#include "gsplatCommonVS"

varying mediump vec2 gaussianUV;
varying mediump vec4 gaussianColor;

#ifndef DITHER_NONE
    varying float id;
#endif

mediump vec4 discardVec = vec4(0.0, 0.0, 2.0, 1.0);

#ifdef PREPASS_PASS
    varying float vLinearDepth;
#endif

#ifdef GSPLAT_OVERDRAW
    uniform sampler2D colorRamp;
    uniform float colorRampIntensity;
#endif

void main(void) {
    // read gaussian details
    SplatSource source;
    if (!initSource(source)) {
        gl_Position = discardVec;
        return;
    }

    vec3 modelCenter = readCenter(source);

    SplatCenter center;
    center.modelCenterOriginal = modelCenter;
    
    modifyCenter(modelCenter);
    center.modelCenterModified = modelCenter;

    if (!initCenter(modelCenter, center)) {
        gl_Position = discardVec;
        return;
    }

    // project center to screen space
    SplatCorner corner;
    if (!initCorner(source, center, corner)) {
        gl_Position = discardVec;
        return;
    }

    // read color
    vec4 clr = readColor(source);

    #if GSPLAT_AA
        // apply AA compensation
        clr.a *= corner.aaFactor;
    #endif

    // evaluate spherical harmonics
    #if SH_BANDS > 0
        // calculate the model-space view direction
        vec3 dir = normalize(center.view * mat3(center.modelView));

        // read sh coefficients
        vec3 sh[SH_COEFFS];
        float scale;
        readSHData(source, sh, scale);

        // evaluate
        clr.xyz += evalSH(sh, dir) * scale;
    #endif

    modifyColor(modelCenter, clr);

    clipCorner(corner, clr.w);

    // write output
    gl_Position = center.proj + vec4(corner.offset, 0, 0);
    gaussianUV = corner.uv;

    #ifdef GSPLAT_OVERDRAW
        // Overdraw visualization mode: color by elevation
        float t = clamp(modelCenter.y / 20.0, 0.0, 1.0);
        vec3 rampColor = textureLod(colorRamp, vec2(t, 0.5), 0.0).rgb;
        clr.a *= (1.0 / 32.0) * colorRampIntensity;
        gaussianColor = vec4(rampColor, clr.a);
    #else
        gaussianColor = vec4(prepareOutputFromGamma(max(clr.xyz, 0.0)), clr.w);
    #endif

    #ifndef DITHER_NONE
        id = float(source.id);
    #endif

    #ifdef PREPASS_PASS
        vLinearDepth = -center.view.z;
    #endif
}
`;
