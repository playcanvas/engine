export default /* wgsl */`

#include "tonemappingPS"
#include "decodePS"
#include "gammaPS"
#include "fogPS"

// prepare the output color for the given gamma-space color
fn prepareOutputFromGamma(gammaColor: vec3f, depth: f32) -> vec3f {
    var color = gammaColor;

    // decode to linear when we need linear-space processing
    #if TONEMAP != NONE || GAMMA == NONE || FOG != NONE
        color = decodeGamma3(color);
    #endif

    // apply fog in linear space
    #if FOG != NONE
        color = addFog(color, depth);
    #endif

    // apply tonemapping
    #if TONEMAP != NONE
        color = toneMap(color);
    #endif

    // encode to gamma when needed
    #if TONEMAP != NONE || (GAMMA != NONE && FOG != NONE)
        color = gammaCorrectOutput(color);
    #endif

    return color;
}
`;
