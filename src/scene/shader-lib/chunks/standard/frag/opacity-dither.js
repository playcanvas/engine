export default /* glsl */`

uniform vec4 blueNoiseJitter;

#ifdef DITHER_BLUENOISE
    uniform sampler2D blueNoiseTex32;
#endif

void opacityDither(float alpha, float id) {
    #ifdef DITHER_BAYER8

        float noise = bayer8(floor(mod(gl_FragCoord.xy + blueNoiseJitter.xy + id, 8.0))) / 64.0;

    #else

        #ifdef DITHER_BLUENOISE
            vec2 uv = fract(gl_FragCoord.xy / 32.0 + blueNoiseJitter.xy + id);
            float noise = texture2DLodEXT(blueNoiseTex32, uv, 0.0).y;
        #endif

        #ifdef DITHER_IGNNOISE
            // based on https://www.iryoku.com/next-generation-post-processing-in-call-of-duty-advanced-warfare/
            vec3 magic = vec3(0.06711056, 0.00583715, 52.9829189);
            float noise = fract(magic.z * fract(dot(gl_FragCoord.xy + blueNoiseJitter.xy + id, magic.xy)));
        #endif

    #endif

    if (alpha < noise)
        discard;
}
`;
