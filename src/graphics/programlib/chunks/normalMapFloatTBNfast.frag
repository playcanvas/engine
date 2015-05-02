uniform sampler2D texture_normalMap;
uniform float material_bumpMapFactor;
void getNormal(inout psInternalData data) {
    vec3 normalMap = unpackNormal(texture2D(texture_normalMap, $UV));
    data.normalMap = normalMap;
    normalMap = mix(vec3(0.0, 0.0, 1.0), normalMap, material_bumpMapFactor);
    data.normalW = normalize(data.TBN * normalMap);
}

