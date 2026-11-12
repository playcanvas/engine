// main shader entry point for the lit material for forward rendering
export default /* wgsl */`

#include "sceneTexturesPS"

@fragment
fn fragmentMain(input: FragmentInput) -> FragmentOutput {

    #ifdef CLIP_PLANES
        applyClipPlanes(vPositionW);
    #endif

    // the lighting is evaluated at the rasterized position, unless the front end sets another
    litArgs_worldPosition = vPositionW;
    dViewDepth = 1.0 / pcPosition.w;

    #include "litUserMainStartPS"

    dReflection = vec4f(0.0);

    #ifdef LIT_CLEARCOAT
        ccSpecularLight = vec3f(0.0);
        ccReflection = vec3f(0.0);
    #endif

    #if LIT_NONE_SLICE_MODE == SLICED
        #include "startNineSlicedPS"
    #elif LIT_NONE_SLICE_MODE == TILED
        #include "startNineSlicedTiledPS"
    #endif

    #ifdef LIT_NEEDS_NORMAL
        #ifdef FLAT_SHADING
            dVertexNormalW = getFlatNormal(vPositionW);
        #else
            dVertexNormalW = normalize(vNormalW);
        #endif

        #ifdef LIT_TANGENTS
            #if defined(LIT_HEIGHTS) || defined(LIT_USE_NORMALS) || defined(LIT_USE_CLEARCOAT_NORMALS) || defined(LIT_GGX_SPECULAR)
                dTangentW = vTangentW;
                dBinormalW = vBinormalW;
            #endif
        #endif

        getViewDir();

        #ifdef LIT_TBN
            getTBN(dTangentW, dBinormalW, dVertexNormalW);
        #endif

        // after the TBN matrix, which is built from the unflipped normal. twoSidedLighting is 0 or 1,
        // the same for every pixel the material renders.
        if (uniform.material_twoSidedLighting != 0.0) {
            handleTwoSidedLighting();
        }
    #endif

    // invoke frontend functions
    evaluateFrontend();

    #include "debugProcessFrontendPS"

    var output: FragmentOutput = evaluateBackend();

    // guarded by the same define the write function tests internally, as vLinearDepth is only
    // generated when the depth is written
    #ifdef SCENE_TEXTURE_DEPTH
        writeSceneTextureDepth(&output, vLinearDepth, 1.0);
    #endif

    #include "litUserMainEndPS"

    return output;
}
`;
