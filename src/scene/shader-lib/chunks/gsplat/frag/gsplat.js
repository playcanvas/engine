export default /* glsl */`

#ifndef DITHER_NONE
    #include "bayerPS"
    #include "opacityDitherPS"
    varying float id;
#endif

#ifdef PICK_PASS
    #include "pickPS"
#endif

#if defined(SHADOW_PASS) || defined(PICK_PASS)
    uniform float alphaClip;
#endif

varying mediump vec2 gaussianUV;
varying mediump vec4 gaussianColor;

void main(void) {
    mediump float A = dot(gaussianUV, gaussianUV);
    if (A > 1.0) {
        discard;
    }

    // evaluate alpha
    mediump float alpha = exp(-A * 4.0) * gaussianColor.a;

    #ifdef PICK_PASS
        if (alpha < alphaClip) {
            discard;
        }
        gl_FragColor = getPickOutput();
    #elif SHADOW_PASS

        if (alpha < alphaClip) {
            discard;
        }
        gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);

    #else
        if (alpha < 1.0 / 255.0) {
            discard;
        }

        #ifndef DITHER_NONE
            opacityDither(alpha, id * 0.013);
        #endif

        gl_FragColor = vec4(gaussianColor.xyz * alpha, alpha);
    #endif
}
`;
