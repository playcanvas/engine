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

    vec3 gammaCorrectOutput(vec3 color) {
        return pow(color + 0.0000001, vec3(1.0 / 2.2));
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
