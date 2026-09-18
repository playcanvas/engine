export default /* wgsl */`

#ifndef DITHER_NONE
    // note: opacityDitherPS pulls in bayerPS itself for the Bayer modes - including it here as
    // well would redeclare its functions, as the preprocessor does not deduplicate includes
    #include "opacityDitherPS"
    #ifdef GSPLAT_STOCHASTIC
        varying @interpolate(flat, either) stochasticId: u32;
    #else
        varying @interpolate(flat, either) id: f32;
    #endif
#endif

#if defined(SHADOW_PASS) || defined(PICK_PASS) || defined(PREPASS_PASS)
    uniform alphaClip: f32;
#endif

#ifdef PREPASS_PASS
    varying @interpolate(flat, either) vLinearDepth: f32;
    #include "floatAsUintPS"
#endif

// the prepass declares this varying above, and the two passes are never generated as one
#if defined(SCENE_TEXTURE_DEPTH) && !defined(PREPASS_PASS)
    varying @interpolate(flat, either) vLinearDepth: f32;
#endif

#include "sceneTexturesPS"

#if !defined(SHADOW_PASS) && !defined(PICK_PASS) && !defined(PREPASS_PASS)
    uniform alphaClipForward: f32;
#endif

const EXP4: half = exp(half(-4.0));
const INV_EXP4: half = half(1.0) / (half(1.0) - EXP4);

fn normExp(x: half) -> half {
    return (exp(x * half(-4.0)) - EXP4) * INV_EXP4;
}

varying gaussianUV: half2;
varying @interpolate(flat, either) gaussianColor: half4;

#if defined(GSPLAT_UNIFIED_ID) && defined(PICK_PASS)
    varying @interpolate(flat, either) vPickId: u32;
#endif

#ifdef PICK_PASS
    #include "pickPS"
#endif

#ifdef SHADOW_PASS
    #include "shadowCasterPS"
#endif

#ifdef GSPLAT_USER_VARYINGS
    #include "gsplatUserVaryingsPS"
#endif
#include "gsplatModifyPS"

@fragment
fn fragmentMain(input: FragmentInput) -> FragmentOutput {
    var output: FragmentOutput;

    let A: half = dot(gaussianUV, gaussianUV);

    // note: no early return after the discard - it would make the control flow non-uniform,
    // preventing user gsplatModifyPS chunks from using derivatives (fwidth etc.)
    if (A > half(1.0)) {
        discard;
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

        // output data for the shadow type being rendered
        output.color = getShadowOutput();

    #elif PREPASS_PASS

        // Dithered splats write depth, so they are collected by the depth prepass. It has to apply
        // the same coverage test as the forward pass, otherwise it claims the full splat footprint
        // and the forward fragments of the splats behind it fail the depth test.
        #ifndef DITHER_NONE
            #ifdef GSPLAT_STOCHASTIC
                opacityDither(f32(alpha), f32(stochasticId) * 0.013);
            #else
                opacityDither(f32(alpha), id * 0.013);
            #endif
        #endif

        output.color = float2vec4(vLinearDepth);

    #else

        if (alpha < half(uniform.alphaClipForward)) {
            discard;
        }

        var fragColor: vec4f = vec4f(vec3f(gaussianColor.xyz), f32(alpha));
        modifySplatColor(vec2f(gaussianUV), &fragColor);

        // Dither the alpha the modifier produced, not the raw gaussian alpha, so a user
        // gsplatModifyPS chunk still controls coverage - in stochastic mode the surviving
        // fragments are opaque, so an alpha it writes would otherwise have no effect at all.
        // This also keeps the dither's discards after the chunk, which may use derivatives.
        #ifndef DITHER_NONE
            #ifdef GSPLAT_STOCHASTIC
                opacityDither(fragColor.a, f32(stochasticId) * 0.013);
            #else
                opacityDither(fragColor.a, id * 0.013);
            #endif
        #endif

        #ifdef GSPLAT_STOCHASTIC
            fragColor.a = 1.0;
        #endif
        output.color = vec4f(fragColor.xyz * fragColor.a, fragColor.a);

        // The same premultiplied blending which composites the color accumulates the scene depth, so
        // the splats gain a depth without being rendered a second time. Dithered splats render as
        // opaque, and the fragments which survive the dither have full coverage.
        // Guarded by the define the write function tests internally, as vLinearDepth is only generated
        // when the depth is written.
        #ifdef SCENE_TEXTURE_DEPTH
            #ifdef DITHER_NONE
                writeSceneTextureDepth(&output, vLinearDepth, fragColor.a);
            #else
                writeSceneTextureDepth(&output, vLinearDepth, 1.0);
            #endif
        #endif
    #endif

    return output;
}`;
