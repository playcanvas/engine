export default /* wgsl */`

#if defined(STD_AO_TEXTURE) || defined(STD_AO_VERTEX)
    uniform material_aoIntensity: f32;
#endif

#ifdef STD_AODETAIL_TEXTURE
    #include "detailModesPS"
#endif

fn getAO() {
    dAo = 1.0;

    #ifdef STD_AO_TEXTURE
        var aoBase: f32 = textureSampleBias({STD_AO_TEXTURE_NAME}, {STD_AO_TEXTURE_NAME}Sampler, {STD_AO_TEXTURE_UV}, uniform.textureBias).{STD_AO_TEXTURE_CHANNEL};

        #ifdef STD_AODETAIL_TEXTURE
            var aoDetail: f32 = textureSampleBias({STD_AODETAIL_TEXTURE_NAME}, {STD_AODETAIL_TEXTURE_NAME}Sampler, {STD_AODETAIL_TEXTURE_UV}, uniform.textureBias).{STD_AODETAIL_TEXTURE_CHANNEL};
            aoBase = detailMode_{STD_AODETAIL_DETAILMODE}(vec3f(aoBase), vec3f(aoDetail)).r;
        #endif

        dAo = dAo * aoBase;
    #endif

    #ifdef STD_AO_VERTEX
        dAo = dAo * saturate(vVertexColor.{STD_AO_VERTEX_CHANNEL});
    #endif

    #if defined(STD_AO_TEXTURE) || defined(STD_AO_VERTEX)
        dAo = mix(1.0, dAo, uniform.material_aoIntensity);
    #endif
}
`;
