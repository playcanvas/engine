uniform sampler2D texture_normalMap;
uniform MEDP float material_bumpiness;

void getNormal() {
    MEDP vec3 normalMap = unpackNormal(texture2D(texture_normalMap, $UV));
    normalMap = normalize(mix(vec3(0.0, 0.0, 1.0), normalMap, material_bumpiness));
    dNormalMap = addNormalDetail(normalMap);
    dNormalW = dTBN * dNormalMap;
}
