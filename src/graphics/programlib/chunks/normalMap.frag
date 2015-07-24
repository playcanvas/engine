uniform sampler2D texture_normalMap;
uniform float material_bumpiness;
void getNormal(inout psInternalData data) {
    vec3 normalMap = unpackNormal(texture2D(texture_normalMap, $UV));
    data.normalMap = normalMap;
    data.normalW = data.TBN * normalMap;
}

