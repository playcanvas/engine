export default /* wgsl */`

#if STD_OPACITY_DITHER == BAYER8
    #include "bayerPS"
#endif

uniform blueNoiseJitter: vec4f;

#if STD_OPACITY_DITHER == BLUENOISE
    var blueNoiseTex32 : texture_2d<f32>;
    var blueNoiseTex32Sampler : sampler;
#endif

fn opacityDither(alpha: f32, id: f32) {
    #if STD_OPACITY_DITHER == BAYER8

        var noise: f32 = bayer8(floor((pcPosition.xy + uniform.blueNoiseJitter.xy + id) % vec2f(8.0))) / 64.0;

    #else

        #if STD_OPACITY_DITHER == BLUENOISE
            var uv = fract(pcPosition.xy / 32.0 + uniform.blueNoiseJitter.xy + id);
            var noise: f32 = textureSampleLevel(blueNoiseTex32, blueNoiseTex32Sampler, uv, 0.0).y;
        #endif

        #if STD_OPACITY_DITHER == IGNNOISE
            // based on https://www.iryoku.com/next-generation-post-processing-in-call-of-duty-advanced-warfare/
            var magic = vec3f(0.06711056, 0.00583715, 52.9829189);
            var noise: f32 = fract(magic.z * fract(dot(pcPosition.xy + uniform.blueNoiseJitter.xy + id, magic.xy)));
        #endif

    #endif

    // convert the noise to linear space, as that is specified in sRGB space (stores perceptual values)
    noise = pow(noise, 2.2);

    if (alpha < noise) {
        discard;
    }
}
`;
