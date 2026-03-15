export default /* glsl */`

#ifndef DITHER_NONE
    #include "bayerPS"
    #include "opacityDitherPS"
    varying float id;
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

#if defined(GSPLAT_UNIFIED_ID) && defined(PICK_PASS)
    flat varying uint vPickId;
#endif

#ifdef PICK_PASS
    #include "pickPS"
#endif

const float EXP4 = exp(-4.0);
const float INV_EXP4 = 1.0 / (1.0 - EXP4);

float normExp(float x) {
    return (exp(x * -4.0) - EXP4) * INV_EXP4;
}

void main(void) {
    mediump float A = dot(gaussianUV, gaussianUV);
    if (A > 1.0) {
        discard;
    }

    mediump float alpha = normExp(A) * gaussianColor.a;

    #if defined(SHADOW_PASS) || defined(PICK_PASS) || defined(PREPASS_PASS)
        if (alpha < alphaClip) {
            discard;
        }
    #endif

    #ifdef PICK_PASS

        #ifdef GSPLAT_UNIFIED_ID
            // Use component ID from work buffer (passed via varying)
            pcFragColor0 = encodePickOutput(vPickId);
        #else
            // Use standard meshInstanceId path
            pcFragColor0 = getPickOutput();
        #endif
        #ifdef DEPTH_PICK_PASS
            pcFragColor1 = getPickDepth();
        #endif

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
