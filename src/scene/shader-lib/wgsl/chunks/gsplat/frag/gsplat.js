export default /* wgsl */`

#ifndef DITHER_NONE
    #include "bayerPS"
    #include "opacityDitherPS"
    varying id: f32;
#endif

#if defined(SHADOW_PASS) || defined(PICK_PASS) || defined(PREPASS_PASS)
    uniform alphaClip: f32;
#endif

#ifdef PREPASS_PASS
    varying vLinearDepth: f32;
    #include "floatAsUintPS"
#endif

const EXP4: half = exp(half(-4.0));
const INV_EXP4: half = half(1.0) / (half(1.0) - EXP4);

fn normExp(x: half) -> half {
    return (exp(x * half(-4.0)) - EXP4) * INV_EXP4;
}

varying gaussianUV: half2;
varying gaussianColor: half4;

#if defined(GSPLAT_UNIFIED_ID) && defined(PICK_PASS)
    varying @interpolate(flat) vPickId: u32;
#endif

#ifdef PICK_PASS
    #include "pickPS"
#endif

@fragment
fn fragmentMain(input: FragmentInput) -> FragmentOutput {
    var output: FragmentOutput;

    let A: half = dot(gaussianUV, gaussianUV);
    if (A > half(1.0)) {
        discard;
        return output;
    }

    // evaluate alpha
    var alpha: half = normExp(A) * gaussianColor.a;

    #if defined(SHADOW_PASS) || defined(PICK_PASS) || defined(PREPASS_PASS)
        if (alpha < half(uniform.alphaClip)) {
            discard;
            return output;
        }
    #endif

    #ifdef PICK_PASS

        #ifdef GSPLAT_UNIFIED_ID
            // Use component ID from work buffer (passed via varying)
            output.color = encodePickOutput(vPickId);
        #else
            // Use standard meshInstanceId path
            output.color = getPickOutput();
        #endif
        #ifdef DEPTH_PICK_PASS
            output.color1 = getPickDepth();
        #endif

    #elif SHADOW_PASS

        output.color = vec4f(0.0, 0.0, 0.0, 1.0);

    #elif PREPASS_PASS

        output.color = float2vec4(vLinearDepth);

    #else

        if (alpha < half(1.0 / 255.0)) {
            discard;
            return output;
        }

        #ifndef DITHER_NONE
            opacityDither(f32(alpha), id * 0.013);
        #endif

        output.color = vec4f(vec3f(gaussianColor.xyz * alpha), f32(alpha));
    #endif

    return output;
}`;
