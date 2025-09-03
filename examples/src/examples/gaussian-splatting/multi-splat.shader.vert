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
    SplatSource source;
    if (!initSource(source)) {
        gl_Position = discardVec;
        return;
    }

    vec3 centerPos = animatePosition(readCenter(source));

    SplatCenter center;
    initCenter(centerPos, center);

    // project center to screen space
    SplatCorner corner;
    if (!initCorner(source, center, corner)) {
        gl_Position = discardVec;
        return;
    }

    // read color
    vec4 clr = readColor(source);

    // evaluate spherical harmonics
    #if SH_BANDS > 0
        vec3 dir = normalize(center.view * mat3(center.modelView));

        // read sh coefficients
        vec3 sh[SH_COEFFS];
        float scale;
        readSHData(source, sh, scale);

        // evaluate
        clr.xyz += evalSH(sh, dir);
    #endif

    clr = animateColor(centerPos.y, clr);

    clipCorner(corner, clr.w);

    // write output
    gl_Position = center.proj + vec4(corner.offset, 0.0, 0.0);
    gaussianUV = corner.uv;
    gaussianColor = vec4(prepareOutputFromGamma(max(clr.xyz, 0.0)), clr.w);

    #ifndef DITHER_NONE
        id = float(state.id);
    #endif
}
