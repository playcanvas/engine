export default /* glsl */`
#include "gsplatCommonVS"

varying mediump vec2 gaussianUV;
varying mediump vec4 gaussianColor;

#ifndef DITHER_NONE
    varying float id;
#endif

mediump vec4 discardVec = vec4(0.0, 0.0, 2.0, 1.0);

void main(void) {
    // read gaussian details
    SplatState state;
    if (!readCenter(state)) {
        gl_Position = discardVec;
        return;
    }

    // project center to screen space
    ProjectedState projState;
    if (!projectCenter(state, projState)) {
        gl_Position = discardVec;
        return;
    }

    // read color
    vec4 clr = readColor(state);

    // evaluate spherical harmonics
    #if SH_BANDS > 0
        clr.xyz = max(vec3(0.0), clr.xyz + evalSH(state, projState));
    #endif

    applyClipping(projState, clr.w);

    // write output
    gl_Position = projState.cornerProj;
    gaussianUV = projState.cornerUV;
    gaussianColor = vec4(prepareOutputFromGamma(clr.xyz), clr.w);

    #ifndef DITHER_NONE
        id = float(state.id);
    #endif
}
`;
