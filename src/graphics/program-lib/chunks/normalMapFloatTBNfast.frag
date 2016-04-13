uniform sampler2D texture_normalMap;
uniform float material_bumpiness;
void getNormal() {
    vec3 normalMap = unpackNormal(texture2D(texture_normalMap, $UV));
    dNormalMap = normalMap;
    normalMap = mix(vec3(0.0, 0.0, 1.0), normalMap, material_bumpiness);
    dNormalW = normalize(dTBN * normalMap);
}

