uniform sampler2D texture_normalMap;
uniform float material_bumpiness;
void getNormal() {
    vec3 normalMap = unpackNormal(texture2D(texture_normalMap, $UV));
    dNormalMap = normalMap;
    dNormalW = dTBN * normalMap;
}

