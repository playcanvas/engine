export default /* glsl */`
#include "gsplatVS"

varying mediump vec2 surfaceUV;
varying mediump vec4 color;

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

    // evaluate optional spherical harmonics
    #if SH_BANDS > 0
        clr.xyz = max(clr.xyz + evalSH(state), 0.0);
    #endif

    // calculate clip size based on alpha
    // float clip = min(1.0, sqrt(-log(1.0 / 255.0 / color.a)) / 2.0);

    color = vec4(prepareOutputFromGamma(clr.xyz), clr.w);
    surfaceUV = state.cornerUV / 2.0;
    gl_Position = state.centerProj + vec4(state.cornerOffset, 0.0, 0.0);

    #ifndef DITHER_NONE
        id = float(state.id);
    #endif
}
`;
