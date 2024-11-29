export default /* glsl */`

#if TONEMAP == FILMIC
    #include "tonemappingFilmicPS"
#elif TONEMAP == LINEAR
    #include "tonemappingLinearPS"
#elif TONEMAP == HEJL
    #include "tonemappingHejlPS"
#elif TONEMAP == ACES
    #include "tonemappingAcesPS"
#elif TONEMAP == ACES2
    #include "tonemappingAces2PS"
#elif TONEMAP == NEUTRAL
    #include "tonemappingNeutralPS"
#endif

#if TONEMAP != NONE
    #if GAMMA == SRGB
        #include "decodePS"
        #include "gamma2_2PS"
    #else
        #include "gamma1_0PS"
    #endif
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

    #if TONEMAP == NONE
        #if GAMMA == NONE
            // convert to linear space
            return decodeGamma(vec4(color.rgb, B));
        #else
            // output gamma space color directly
            return vec4(color.rgb, B);
        #endif
    #else
        // apply tonemapping in linear space and output to linear or
        // gamma (which is handled by gammaCorrectOutput)
        return vec4(gammaCorrectOutput(toneMap(decodeGamma(color.rgb))), B);
    #endif
}
`;
