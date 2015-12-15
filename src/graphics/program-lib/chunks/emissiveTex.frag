uniform sampler2D texture_emissiveMap;
vec3 getEmission(inout psInternalData data) {
    return $texture2DSAMPLE(texture_emissiveMap, $UV).$CH;
}

