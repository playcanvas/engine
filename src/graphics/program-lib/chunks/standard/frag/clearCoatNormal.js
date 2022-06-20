export default /* glsl */`
#ifdef MAPTEXTURE
uniform sampler2D texture_clearCoatNormalMap;
uniform float material_clearCoatBumpiness;
#endif

void getClearCoatNormal() {
#ifdef MAPTEXTURE
    vec3 normalMap = unpackNormal(texture2D(texture_clearCoatNormalMap, $UV, textureBias));
    normalMap = mix(vec3(0.0, 0.0, 1.0), normalMap, material_clearCoatBumpiness);
    ccNormalW = normalize(dTBN * normalMap);
#else
    ccNormalW = dVertexNormalW;
#endif
}
`;
