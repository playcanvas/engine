// main shader entry point for the lit material for forward rendering
export default /* glsl */`

#include "sceneTexturesPS"

void main(void) {

    #include "litUserMainStartPS"

    dReflection = vec4(0);

    #ifdef LIT_CLEARCOAT
        ccSpecularLight = vec3(0);
        ccReflection = vec3(0);
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

            #ifdef LIT_TWO_SIDED_LIGHTING
                handleTwoSidedLighting();
            #endif
        #endif
    #endif

    // invoke frontend functions
    evaluateFrontend();

    #include "debugProcessFrontendPS"

    evaluateBackend();

    // guarded by the same define the write function tests internally, as vLinearDepth is only
    // generated when the depth is written
    #ifdef SCENE_TEXTURE_DEPTH
        writeSceneTextureDepth(vLinearDepth, 1.0);
    #endif

    #include "litUserMainEndPS"
}
`;
