export default /* glsl */`

#if STD_OPACITY_DITHER == BAYER2 || STD_OPACITY_DITHER == BAYER4 || STD_OPACITY_DITHER == BAYER8 || STD_OPACITY_DITHER == BAYER16
    #include "bayerPS"
#endif

uniform vec4 blueNoiseJitter;

#if STD_OPACITY_DITHER == BLUENOISE
    uniform sampler2D blueNoiseTex32;
#endif

void opacityDither(float alpha, float id) {
    if (alpha <= 0.0)
        discard;

    if (alpha >= 1.0)
        return;

    #if STD_OPACITY_DITHER == BAYER8

        float noise = bayer8(floor(mod(gl_FragCoord.xy + blueNoiseJitter.xy + id, 8.0))) / 64.0;

    #else

        #if STD_OPACITY_DITHER == BAYER2
            float noise = bayer2(floor(mod(gl_FragCoord.xy + blueNoiseJitter.xy + id, 2.0))) / 4.0;
        #endif

        #if STD_OPACITY_DITHER == BAYER4
            float noise = bayer4(floor(mod(gl_FragCoord.xy + blueNoiseJitter.xy + id, 4.0))) / 16.0;
        #endif

        #if STD_OPACITY_DITHER == BAYER16
            float noise = bayer16(floor(mod(gl_FragCoord.xy + blueNoiseJitter.xy + id, 16.0))) / 256.0;
        #endif

        #if STD_OPACITY_DITHER == BLUENOISE
            vec2 uv = fract(gl_FragCoord.xy / 32.0 + blueNoiseJitter.xy + id);
            float noise = texture2DLod(blueNoiseTex32, uv, 0.0).y;
        #endif

        #if STD_OPACITY_DITHER == IGNNOISE
            // based on https://www.iryoku.com/next-generation-post-processing-in-call-of-duty-advanced-warfare/
            vec3 magic = vec3(0.06711056, 0.00583715, 52.9829189);
            float noise = fract(magic.z * fract(dot(gl_FragCoord.xy + blueNoiseJitter.xy + id, magic.xy)));
        #endif

    #endif

    // convert the noise to linear space, as that is specified in sRGB space (stores perceptual values)
    noise = pow(noise, 2.2);

    if (alpha < noise)
        discard;
}
`;
