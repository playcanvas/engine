export default /* glsl */`
#ifdef STD_NORMAL_TEXTURE_ENABLED
uniform float material_bumpiness;
#endif

void getNormal() {
#ifdef STD_NORMAL_TEXTURE_ENABLED
    vec3 normalMap = unpackNormal(texture2DBias({STD_NORMAL_TEXTURE}, {STD_NORMAL_TEXTURE_UV}, textureBias));
    normalMap = mix(vec3(0.0, 0.0, 1.0), normalMap, material_bumpiness);
    dNormalW = normalize(dTBN * addNormalDetail(normalMap));
#else
    dNormalW = dVertexNormalW;
#endif
}
`;
