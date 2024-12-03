export default /* glsl */`
#include "gsplatCommonVS"

varying mediump vec2 gaussianUV;
varying mediump vec4 gaussianColor;

#ifndef DITHER_NONE
    varying float id;
#endif

mediump vec4 discardVec = vec4(0.0, 0.0, 2.0, 1.0);

void main(void) {
    SplatState state;

    // read gaussian center
    if (!readCenter(state)) {
        gl_Position = discardVec;
        return;
    }

    // project center to screen space
    if (!projectCenter(state)) {
        gl_Position = discardVec;
        return;
    }

    // read color
    vec4 clr = readColor(state);

    // evaluate spherical harmonics
    #if SH_BANDS > 0
        clr.xyz = max(clr.xyz + evalSH(state), 0.0);
    #endif

    // calculate the clip amount to exclude the semitransparent outer region
    float clip = min(1.0, sqrt(-log(1.0 / 255.0 / clr.w)) / 2.0);

    gl_Position = state.centerProj + vec4(state.cornerOffset * clip, 0.0, 0.0);
    gaussianUV = state.cornerUV / 2.0 * clip;
    gaussianColor = vec4(prepareOutputFromGamma(clr.xyz), clr.w);

    #ifndef DITHER_NONE
        id = float(state.id);
    #endif
}
`;
