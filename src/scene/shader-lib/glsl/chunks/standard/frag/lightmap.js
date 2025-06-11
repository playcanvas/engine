export default /* glsl */`

#ifdef STD_LIGHTMAP_DIR
    vec3 dLightmapDir;
    uniform sampler2D texture_dirLightMap;
#endif

void getLightMap() {

    dLightmap = vec3(1.0);

    #ifdef STD_LIGHT_TEXTURE
        dLightmap *= {STD_LIGHT_TEXTURE_DECODE}(texture2DBias({STD_LIGHT_TEXTURE_NAME}, {STD_LIGHT_TEXTURE_UV}, textureBias)).{STD_LIGHT_TEXTURE_CHANNEL};

        #ifdef STD_LIGHTMAP_DIR
            vec3 dir = texture2DBias(texture_dirLightMap, {STD_LIGHT_TEXTURE_UV}, textureBias).xyz * 2.0 - 1.0;
            float dirDot = dot(dir, dir);
            dLightmapDir = (dirDot > 0.001) ? dir / sqrt(dirDot) : vec3(0.0);
        #endif
    #endif

    #ifdef STD_LIGHT_VERTEX
        dLightmap *= saturate(vVertexColor.{STD_LIGHT_VERTEX_CHANNEL});
    #endif
}
`;
