uniform sampler2D texture_emissiveMap;
vec3 getEmission() {
    return $texture2DSAMPLE(texture_emissiveMap, $UV).$CH;
}

