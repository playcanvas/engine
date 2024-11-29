export default /* glsl */`
#include "gsplatOutputPS"

#ifndef DITHER_NONE
    #include "bayerPS"
    #include "opacityDitherPS"
    varying float id;
#endif

#ifdef PICK_PASS
    uniform vec4 uColor;
#endif

varying mediump vec2 texCoord;
varying mediump vec4 color;

void main(void) {
    mediump float A = dot(texCoord, texCoord);
    if (A > 1.0) {
        discard;
    }

    // evaluate alpha
    mediump float alpha = exp(-A * 4.0) * color.a;

    #ifdef PICK_PASS
        if (alpha < 0.3) {
            discard;
        }
        gl_FragColor = uColor;
    #else
        if (alpha < 1.0 / 255.0) {
            discard;
        }

        #ifndef DITHER_NONE
            opacityDither(alpha, id * 0.013);
        #endif

        gl_FragColor = vec4(prepareOutputFromGamma(color.xyz), alpha);
    #endif
}
`;
