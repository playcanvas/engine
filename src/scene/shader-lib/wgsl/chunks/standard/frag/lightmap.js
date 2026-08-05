export default /* wgsl */`

#ifdef STD_LIGHTMAP_DIR
    var<private> dLightmapDir: vec3f;
    var texture_dirLightMap: texture_2d<f32>;
    var texture_dirLightMapSampler: sampler;
#endif

fn getLightMap() {

    dLightmap = vec3f(1.0);

    #ifdef STD_LIGHT_TEXTURE
        dLightmap = dLightmap * {STD_LIGHT_TEXTURE_DECODE}(textureSampleBias({STD_LIGHT_TEXTURE_NAME}, {STD_LIGHT_TEXTURE_NAME}Sampler, {STD_LIGHT_TEXTURE_UV}, uniform.textureBias)).{STD_LIGHT_TEXTURE_CHANNEL};

        #ifdef STD_LIGHTMAP_DIR
            var dir: vec3f = textureSampleBias(texture_dirLightMap, texture_dirLightMapSampler, {STD_LIGHT_TEXTURE_UV}, uniform.textureBias).xyz * 2.0 - 1.0;
            var dirDot = dot(dir, dir);
            dLightmapDir = select(vec3(0.0), dir / sqrt(dirDot), dirDot > 0.001);
        #endif
    #endif

    #ifdef STD_LIGHT_VERTEX
        dLightmap = dLightmap * saturate(vVertexColor.{STD_LIGHT_VERTEX_CHANNEL});
    #endif
}
`;
