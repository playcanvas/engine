#include "gsplatCommonVS"

varying mediump vec2 gaussianUV;
varying mediump vec4 gaussianColor;

#ifndef DITHER_NONE
    varying float id;
#endif

mediump vec4 discardVec = vec4(0.0, 0.0, 2.0, 1.0);

uniform float uTime;

vec3 animatePosition(vec3 center) {
    // modify center
    float heightIntensity = center.y * 0.2;
    center.x += sin(uTime * 5.0 + center.y) * 0.3 * heightIntensity;

    // output y-coordinate
    return center;
}

vec4 animateColor(float height, vec4 clr) {
    float sineValue = abs(sin(uTime * 5.0 + height));

    #ifdef CUTOUT
        // in cutout mode, remove pixels along the wave
        if (sineValue < 0.5) {
            clr.a = 0.0;
        }
    #else
        // in non-cutout mode, add a golden tint to the wave
        vec3 gold = vec3(1.0, 0.85, 0.0);
        float blend = smoothstep(0.9, 1.0, sineValue);
        clr.xyz = mix(clr.xyz, gold, blend);
    #endif

    return clr;
}

void main(void) {
    // read gaussian center
    SplatState state;
    if (!initState(state)) {
        gl_Position = discardVec;
        return;
    }

    vec3 center = animatePosition(readCenter(state));

    // project center to screen space
    ProjectedState projState;
    if (!projectCenter(state, center, projState)) {
        gl_Position = discardVec;
        return;
    }

    // read color
    vec4 clr = readColor(state);

    // evaluate spherical harmonics
    #if SH_BANDS > 0
        clr.xyz = max(clr.xyz + evalSH(state, projState), 0.0);
    #endif

    clr = animateColor(center.y, clr);

    applyClipping(projState, clr.w);

    // write output
    gl_Position = projState.cornerProj;
    gaussianUV = projState.cornerUV;
    gaussianColor = vec4(prepareOutputFromGamma(clr.xyz), clr.w);

    #ifndef DITHER_NONE
        id = float(state.id);
    #endif
}
