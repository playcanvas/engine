// main shader entry point for the lit material for forward rendering
export default /* wgsl */`

@fragment
fn fragmentMain(input: FragmentInput) -> FragmentOutput {

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
        dVertexNormalW = normalize(vNormalW);

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

    var output: FragmentOutput = evaluateBackend();

    #include "litUserMainEndPS"

    return output;
}
`;
