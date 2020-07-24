uniform sampler2D texture_normalMap;

void getNormal() {
    vec3 normalMap = unpackNormal(texture2D(texture_normalMap, $UV));
    dNormalMap = addNormalDetail(normalMap);
    dNormalW = dTBN * dNormalMap;

    #ifdef CLEARCOAT
    ccNormalW = normalize(dVertexNormalW);
    #endif
}
