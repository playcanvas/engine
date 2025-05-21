export default /* glsl */`
#ifdef STD_NORMAL_TEXTURE
    uniform float material_bumpiness;
#endif

#ifdef STD_NORMALDETAIL_TEXTURE
    uniform float material_normalDetailMapBumpiness;

    vec3 blendNormals(vec3 n1, vec3 n2) {
        // https://blog.selfshadow.com/publications/blending-in-detail/#detail-oriented
        n1 += vec3(0, 0, 1);
        n2 *= vec3(-1, -1, 1);
        return n1 * dot(n1, n2) / n1.z - n2;
    }
#endif

void getNormal() {
#ifdef STD_NORMAL_TEXTURE
    vec3 normalMap = {STD_NORMAL_TEXTURE_DECODE}(texture2DBias({STD_NORMAL_TEXTURE_NAME}, {STD_NORMAL_TEXTURE_UV}, textureBias));
    normalMap = mix(vec3(0.0, 0.0, 1.0), normalMap, material_bumpiness);

    #ifdef STD_NORMALDETAIL_TEXTURE
        vec3 normalDetailMap = {STD_NORMALDETAIL_TEXTURE_DECODE}(texture2DBias({STD_NORMALDETAIL_TEXTURE_NAME}, {STD_NORMALDETAIL_TEXTURE_UV}, textureBias));
        normalDetailMap = mix(vec3(0.0, 0.0, 1.0), normalDetailMap, material_normalDetailMapBumpiness);
        normalMap = blendNormals(normalMap, normalDetailMap);
    #endif

    dNormalW = normalize(dTBN * normalMap);
#else
    dNormalW = dVertexNormalW;
#endif
}
`;
