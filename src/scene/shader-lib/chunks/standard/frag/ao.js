export default /* glsl */`

#if defined(STD_AO_TEXTURE) || defined(STD_AO_VERTEX)
    uniform float material_aoIntensity;
#endif

void getAO() {
    dAo = 1.0;

    #ifdef STD_AO_TEXTURE
        float aoBase = texture2DBias({STD_AO_TEXTURE_NAME}, {STD_AO_TEXTURE_UV}, textureBias).{STD_AO_TEXTURE_CHANNEL};
        dAo *= addAoDetail(aoBase);
    #endif

    #ifdef STD_AO_VERTEX
        dAo *= saturate(vVertexColor.{STD_AO_VERTEX_CHANNEL});
    #endif

    #if defined(STD_AO_TEXTURE) || defined(STD_AO_VERTEX)
        dAo = mix(1.0, dAo, material_aoIntensity);
    #endif
}
`;
