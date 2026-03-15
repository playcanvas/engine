export default /* glsl */`

#if STD_OPACITY_DITHER == BAYER8
    #include "bayerPS"
#endif

uniform vec4 blueNoiseJitter;

#if STD_OPACITY_DITHER == BLUENOISE
    uniform sampler2D blueNoiseTex32;
#endif

void opacityDither(float alpha, float id) {
    #if STD_OPACITY_DITHER == BAYER8

        float noise = bayer8(floor(mod(gl_FragCoord.xy + blueNoiseJitter.xy + id, 8.0))) / 64.0;

    #else

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
