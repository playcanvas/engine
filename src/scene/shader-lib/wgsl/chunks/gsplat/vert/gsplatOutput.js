export default /* wgsl */`

#include "tonemappingPS"
#include "decodePS"
#include "gammaPS"
#include "fogPS"

#if FOG != NONE && !defined(GSPLAT_NO_FOG)
    #define GSPLAT_FOG
#endif

// prepare the output color for the given gamma-space color
fn prepareOutputFromGamma(gammaColor: vec3f, depth: f32) -> vec3f {
    var color = gammaColor;

    // decode to linear when we need linear-space processing
    #if TONEMAP != NONE || GAMMA == NONE || defined(GSPLAT_FOG)
        color = decodeGamma3(color);
    #endif

    // apply fog in linear space
    #ifdef GSPLAT_FOG
        color = addFog(color, depth);
    #endif

    // apply tonemapping
    #if TONEMAP != NONE
        color = toneMap(color);
    #endif

    // encode to gamma when needed
    #if TONEMAP != NONE || (GAMMA != NONE && defined(GSPLAT_FOG))
        color = gammaCorrectOutput(color);
    #endif

    return color;
}
`;
