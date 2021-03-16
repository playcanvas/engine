uniform sampler2D texture_normalMap;

void getNormal() {
    MMEDP vec3 normalMap = unpackNormal(texture2D(texture_normalMap, $UV));
    dNormalMap = addNormalDetail(normalMap);
    dNormalW = dTBN * dNormalMap;
}
