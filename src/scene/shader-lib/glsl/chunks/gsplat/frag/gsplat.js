export default /* glsl */`

#ifndef DITHER_NONE
    #include "bayerPS"
    #include "opacityDitherPS"
    varying float id;
#endif

#ifdef PICK_PASS
    #include "pickPS"
#endif

#if defined(SHADOW_PASS) || defined(PICK_PASS) || defined(PREPASS_PASS)
    uniform float alphaClip;
#endif

#ifdef PREPASS_PASS
    varying float vLinearDepth;
    #include "floatAsUintPS"
#endif

varying mediump vec2 gaussianUV;
varying mediump vec4 gaussianColor;

// Fast approximate e^x based on https://nic.schraudolph.org/pubs/Schraudolph99.pdf
const float  EXP_A      = 12102203.0;   // ≈ 2^23 / ln(2)
const int    EXP_BC_RMS = 1064866808;   // (127 << 23) - 60 801*8
float fastExp(float x) {
    int i = int(EXP_A * x) + EXP_BC_RMS;
    return intBitsToFloat(i);
}

void main(void) {
    mediump float A = dot(gaussianUV, gaussianUV);
    if (A > 1.0) {
        discard;
    }

    // evaluate alpha
    mediump float alpha = exp(-A * 4.0) * gaussianColor.a;
    // mediump float alpha = fastExp(-A * 4.0) * gaussianColor.a;
    // mediump float alpha = pow(1.0 - A, 3.0) * gaussianColor.a;

    #if defined(SHADOW_PASS) || defined(PICK_PASS) || defined(PREPASS_PASS)
        if (alpha < alphaClip) {
            discard;
        }
    #endif

    #ifdef PICK_PASS

        gl_FragColor = getPickOutput();

    #elif SHADOW_PASS

        gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);

    #elif PREPASS_PASS

        gl_FragColor = float2vec4(vLinearDepth);

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
