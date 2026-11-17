export default /* glsl */`

#include "decodePS"

#if (GAMMA == SRGB)

    float gammaCorrectInput(float color) {
        return decodeGamma(color);
    }

    vec3 gammaCorrectInput(vec3 color) {
        return decodeGamma(color);
    }

    vec4 gammaCorrectInput(vec4 color) {
        return vec4(decodeGamma(color.xyz), color.w);
    }

    // the exact sRGB transfer, the inverse of decodeGamma and of the GPU's sRGB texture decode
    vec3 gammaCorrectOutput(vec3 color) {
        color = max(color, vec3(0.0));
        return mix(1.055 * pow(color, vec3(1.0 / 2.4)) - 0.055, color * 12.92, lessThanEqual(color, vec3(0.0031308)));
    }

#else // NONE

    float gammaCorrectInput(float color) {
        return color;
    }

    vec3 gammaCorrectInput(vec3 color) {
        return color;
    }

    vec4 gammaCorrectInput(vec4 color) {
        return color;
    }

    vec3 gammaCorrectOutput(vec3 color) {
        return color;
    }

#endif
`;
