export default /* glsl */`
uniform sampler2D texture_normalMap;

void getNormal() {
    vec3 normalMap = unpackNormal(texture2D(texture_normalMap, $UV, textureBias));
    dNormalMap = addNormalDetail(normalMap);
}
`;
