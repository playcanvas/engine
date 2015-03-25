uniform sampler2D texture_emissiveMap;
uniform vec3 material_emissive;
vec3 getEmission(inout psInternalData data) {
    return $texture2DSAMPLE(texture_emissiveMap, $UV).$CH * material_emissive;
}

