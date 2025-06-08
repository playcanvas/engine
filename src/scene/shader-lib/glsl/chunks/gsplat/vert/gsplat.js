export default /* glsl */`
#include "gsplatCommonVS"

varying mediump vec2 gaussianUV;
varying mediump vec4 gaussianColor;

uniform mat4 matrix_projection;

#ifndef DITHER_NONE
    varying float id;
#endif

mediump vec4 discardVec = vec4(0.0, 0.0, 2.0, 1.0);

#ifdef PREPASS_PASS
    varying float vLinearDepth;
#endif

#include "gsplatAnimatePRSVS"
#include "gsplatAnimateColorVS"

void readPRS(SplatSource source, out SplatPRS prs) {
    prs.position = readPosition(source);
    vec4 quat;
    readRotationAndScale(source, quat, prs.scale);
    prs.rotation = quatToMat3(quat);
}

void main(void) {
    // read gaussian details
    SplatSource source;
    if (!initSource(source)) {
        gl_Position = discardVec;
        return;
    }

    // read PRS
    SplatPRS prs;
    readPRS(source, prs);

    // update PRS
    animatePRS(prs);

    // transform PRS to view space
    SplatPRS viewPRS;
    transformPRS(prs, viewPRS);

    // project center to screen space
    vec2 v0, v1;
    float aaFactor;
    if (!project2D(viewPRS, matrix_projection, v0, v1, aaFactor)) {
        gl_Position = discardVec;
        return;
    }

    // read color
    vec4 clr = readColor(source);

    // evaluate spherical harmonics
    #if SH_BANDS > 0
        // calculate the model-space view direction
        vec3 dir = normalize(viewPRS.position * mat3(center.modelView));
        clr.xyz += evalSH(source, dir);
    #endif

    animateColor(prs, clr);

    #if GSPLAT_AA
        // apply AA compensation
        clr.w *= aaFactor;
    #endif

    clipCorner(corner, clr.w);

    // write output
    gl_Position = center.proj + vec4(corner.offset, 0, 0);
    gaussianUV = corner.uv;
    gaussianColor = vec4(prepareOutputFromGamma(max(clr.xyz, 0.0)), clr.w);

    #ifndef DITHER_NONE
        id = float(source.id);
    #endif

    #ifdef PREPASS_PASS
        vLinearDepth = -center.view.z;
    #endif
}
`;
