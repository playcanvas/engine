export default /* glsl */`
#ifdef STD_CLEARCOATNORMAL_TEXTURE
uniform float material_clearCoatBumpiness;
#endif

void getClearCoatNormal() {
#ifdef STD_CLEARCOATNORMAL_TEXTURE
    vec3 normalMap = {STD_CLEARCOATNORMAL_TEXTURE_DECODE}(texture2DBias({STD_CLEARCOATNORMAL_TEXTURE_NAME}, {STD_CLEARCOATNORMAL_TEXTURE_UV}, textureBias));
    normalMap = mix(vec3(0.0, 0.0, 1.0), normalMap, material_clearCoatBumpiness);
    ccNormalW = normalize(dTBN * normalMap);
#else
    ccNormalW = dVertexNormalW;
#endif
}
`;
