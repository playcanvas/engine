#include "gsplatCommonVS"

varying mediump vec2 gaussianUV;
varying mediump vec4 gaussianColor;

#ifndef DITHER_NONE
    varying float id;
#endif

mediump vec4 discardVec = vec4(0.0, 0.0, 2.0, 1.0);

uniform float fade;

// animate position based on the fade value
vec3 animatePosition(vec3 pos) {
    // Use a sine wave to create a smooth scale down and back up animation
    float angle = fade * 3.14159265;
    float shrinkFactor = sin(angle) * 0.3;
    float scale = 1.0 - shrinkFactor;
    return pos * scale;
}

// animate color based on the fade value
vec4 animateColor(vec4 clr) {

    // Check if the color is approximately grayscale
    float r = clr.r;
    float g = clr.g;
    float b = clr.b;

    float grayscaleThreshold = 0.01;
    bool isGrayscale = abs(r - g) < grayscaleThreshold &&
                       abs(r - b) < grayscaleThreshold &&
                       abs(g - b) < grayscaleThreshold;

    if (isGrayscale) {
        // If the color is grayscale, make it very bright (the PC logo)
        clr.rgb *= 10.0;
    } else {
        // cross fade blue to original orange color based on fade value
        clr.rgb = mix(clr.bgr * 0.5, clr.rgb, fade);
    }

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
        clr.xyz += evalSH(state, dir);
    #endif

    clr = animateColor(clr);

    clipCorner(corner, clr.w);

    // write output
    gl_Position = center.proj + vec4(corner.offset, 0.0, 0.0);
    gaussianUV = corner.uv;
    gaussianColor = vec4(prepareOutputFromGamma(max(clr.xyz, 0.0)), clr.w);

    #ifndef DITHER_NONE
        id = float(state.id);
    #endif
}
