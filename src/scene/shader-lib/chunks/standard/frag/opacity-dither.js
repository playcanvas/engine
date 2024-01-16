export default /* glsl */`

#ifndef DITHER_BAYER8
#ifdef WEBGPU
    precision highp sampler2DArray;
    uniform sampler2DArray blueNoiseTex32;
    const float depthDivisor = 1.0;
#else
    precision highp sampler3D;
    uniform sampler3D blueNoiseTex32;
    const float depthDivisor = 32.0;
#endif
uniform float blueNoiseFrame;
#endif

uniform vec4 blueNoiseJitter;



void opacityDither(float alpha, float id) {
    #ifdef DITHER_BAYER8

        float noise = bayer8(floor(mod(gl_FragCoord.xy + blueNoiseJitter.xy + id, 8.0))) / 64.0;

    #else   // blue noise

        vec2 uv2D = fract(gl_FragCoord.xy / 32.0 + blueNoiseJitter.xy + id);
        vec3 uv3D = vec3(uv2D, blueNoiseFrame / depthDivisor);
        float noise = texture(blueNoiseTex32, uv3D).r;

    #endif

    if (alpha < noise)
        discard;
}
`;
