export default /* glsl */`
#include "decodePS"

#if defined(TONEMAP_FILMIC)
    #include "tonemappingFilmicPS"
#elif defined(TONEMAP_LINEAR)
    #include "tonemappingLinearPS"
#elif defined(TONEMAP_HEJL)
    #include "tonemappingHejlPS"
#elif defined(TONEMAP_ACES)
    #include "tonemappingAcesPS"
#elif defined(TONEMAP_ACES2)
    #include "tonemappingAces2PS"
#elif defined(TONEMAP_NEUTRAL)
    #include "tonemappingNeutralPS"
#else
    #include "tonemappingNonePS"
#endif

#if defined(GAMMA_NONE)
    #include "gamma1_0PS"
#else
    #include "gamma2_2PS"
#endif

#if !defined(DITHER_NONE)
    #include "bayerPS"
    #include "opacityDitherPS"
#endif

#ifndef DITHER_NONE
    varying float id;
#endif

#ifdef PICK_PASS
    uniform vec4 uColor;
#endif

vec4 evalSplat(vec2 texCoord, vec4 color) {
    mediump float A = dot(texCoord, texCoord);
    if (A > 1.0) {
        discard;
    }

    mediump float B = exp(-A * 4.0) * color.a;
    if (B < 1.0 / 255.0) {
        discard;
    }

    #ifdef PICK_PASS
        if (B < 0.3) {
            discard;
        }
        return uColor;
    #endif

    #ifndef DITHER_NONE
        opacityDither(B, id * 0.013);
    #endif

    #if !defined(TONEMAP_NONE)
        return vec4(gammaCorrectOutput(toneMap(decodeGamma(color.rgb))), B);
    #else
        return vec4(color.rgb, B);
    #endif
}
`;
