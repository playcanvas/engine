export default /* wgsl */`

#include "decodePS"

#if (GAMMA == SRGB)

    fn gammaCorrectInput(color: f32) -> f32 {
        return decodeGammaFloat(color);
    }

    fn gammaCorrectInputVec3(color: vec3f) -> vec3f {
        return decodeGamma3(color);
    }

    fn gammaCorrectInputVec4(color: vec4f) -> vec4f {
        return vec4f(decodeGamma3(color.xyz), color.w);
    }

    // the exact sRGB transfer, the inverse of decodeGamma and of the GPU's sRGB texture decode
    fn gammaCorrectOutput(color: vec3f) -> vec3f {
        let c = max(color, vec3f(0.0));
        return select(1.055 * pow(c, vec3f(1.0 / 2.4)) - vec3f(0.055), c * 12.92, c <= vec3f(0.0031308));
    }

#else // NONE

    fn gammaCorrectInput(color: f32) -> f32 {
        return color;
    }

    fn gammaCorrectInputVec3(color: vec3f) -> vec3f {
        return color;
    }

    fn gammaCorrectInputVec4(color: vec4f) -> vec4f {
        return color;
    }

    fn gammaCorrectOutput(color: vec3f) -> vec3f {
        return color;
    }

#endif
`;
