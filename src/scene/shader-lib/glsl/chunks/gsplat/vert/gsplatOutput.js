export default /* glsl */`

#include "tonemappingPS"
#include "decodePS"
#include "gammaPS"
#include "fogPS"

#if FOG != NONE && !defined(GSPLAT_NO_FOG)
    #define GSPLAT_FOG
#endif

#if TONEMAP != NONE && !defined(GSPLAT_NO_TONEMAP)
    #define GSPLAT_TONEMAP
#endif

// prepare the output color for the given gamma-space color
vec3 prepareOutputFromGamma(vec3 gammaColor, float depth) {
    vec3 color = gammaColor;

    // decode to linear when we need linear-space processing
    #if defined(GSPLAT_TONEMAP) || GAMMA == NONE || defined(GSPLAT_FOG)
        color = decodeGamma(color);
    #endif

    // apply fog in linear space
    #ifdef GSPLAT_FOG
        color = addFog(color, depth);
    #endif

    // apply tonemapping
    #ifdef GSPLAT_TONEMAP
        color = toneMap(color);
    #endif

    // encode to gamma when needed
    #if defined(GSPLAT_TONEMAP) || (GAMMA != NONE && defined(GSPLAT_FOG))
        color = gammaCorrectOutput(color);
    #endif

    return color;
}
`;
