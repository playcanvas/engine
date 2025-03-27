export default /* glsl */`

#if defined(STD_AO_TEXTURE_ENABLED) || defined(STD_AO_VERTEX_ENABLED)
    uniform float material_aoIntensity;
#endif

void getAO() {
    dAo = 1.0;

    #ifdef STD_AO_TEXTURE_ENABLED
        float aoBase = texture2DBias({STD_AO_TEXTURE}, {STD_AO_TEXTURE_UV}, textureBias).{STD_AO_TEXTURE_CHANNEL};
        dAo *= addAoDetail(aoBase);
    #endif

    #ifdef STD_AO_VERTEX_ENABLED
        dAo *= saturate(vVertexColor.{STD_AO_VERTEX_CHANNEL});
    #endif

    #if defined(STD_AO_TEXTURE_ENABLED) || defined(STD_AO_VERTEX_ENABLED)
        dAo = mix(1.0, dAo, material_aoIntensity);
    #endif
}
`;
