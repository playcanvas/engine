export default /* wgsl */`

#ifndef DITHER_NONE
    #include "bayerPS"
    #include "opacityDitherPS"
    varying id: f32;
#endif

#ifdef PICK_PASS
    #include "pickPS"
#endif

#if defined(SHADOW_PASS) || defined(PICK_PASS) || defined(PREPASS_PASS)
    uniform alphaClip: f32;
#endif

#ifdef PREPASS_PASS
    varying vLinearDepth: f32;
    #include "floatAsUintPS"
#endif

const EXP4      = exp(-4.0);
const INV_EXP4  = 1.0 / (1.0 - EXP4);

fn normExp(x: f32) -> f32 {
    return (exp(x * -4.0) - EXP4) * INV_EXP4;
}

varying gaussianUV: vec2f;
varying gaussianColor: vec4f;

@fragment
fn fragmentMain(input: FragmentInput) -> FragmentOutput {
    var output: FragmentOutput;

    let A: f32 = dot(gaussianUV, gaussianUV);
    if (A > 1.0) {
        discard;
        return output;
    }

    // evaluate alpha
    var alpha = normExp(A) * gaussianColor.a;

    #if defined(SHADOW_PASS) || defined(PICK_PASS) || defined(PREPASS_PASS)
        if (alpha < uniform.alphaClip) {
            discard;
            return output;
        }
    #endif

    #ifdef PICK_PASS

        output.color = getPickOutput();

    #elif SHADOW_PASS

        output.color = vec4f(0.0, 0.0, 0.0, 1.0);

    #elif PREPASS_PASS

        output.color = float2vec4(vLinearDepth);

    #else

        if (alpha < (1.0 / 255.0)) {
            discard;
            return output;
        }

        #ifndef DITHER_NONE
            opacityDither(&alpha, id * 0.013);
        #endif

        output.color = vec4f(input.gaussianColor.xyz * alpha, alpha);
    #endif

    return output;
}`;
