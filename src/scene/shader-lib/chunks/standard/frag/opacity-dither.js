export default /* glsl */`

uniform vec4 blueNoiseJitter;

#ifndef DITHER_BAYER8
    uniform sampler2D blueNoiseTex32;
#endif

void opacityDither(float alpha, float id) {
    #ifdef DITHER_BAYER8

        float noise = bayer8(floor(mod(gl_FragCoord.xy + blueNoiseJitter.xy + id, 8.0))) / 64.0;

    #else   // blue noise

        vec2 uv = fract(gl_FragCoord.xy / 32.0 + blueNoiseJitter.xy + id);
        float noise = texture2DLodEXT(blueNoiseTex32, uv, 0.0).y;

    #endif

    if (alpha < noise)
        discard;
}
`;
