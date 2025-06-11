export default /* wgsl */`

#include "tonemappingPS"
#include "decodePS"
#include "gammaPS"

// prepare the output color for the given gamma-space color
fn prepareOutputFromGamma(gammaColor: vec3f) -> vec3f {
    #if TONEMAP == NONE
        #if GAMMA == NONE
            // convert to linear space
            return decodeGamma(gammaColor);
        #else 
            // output gamma space color directly
            return gammaColor;
        #endif
    #else
        // apply tonemapping in linear space and output to linear or
        // gamma (which is handled by gammaCorrectOutput)
        return gammaCorrectOutput(toneMap(decodeGamma3(gammaColor)));
    #endif
}
`;
