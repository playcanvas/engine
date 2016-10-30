uniform sampler2D texture_emissiveMap;
uniform float material_emissiveIntensity;
vec3 getEmission() {
    return $texture2DSAMPLE(texture_emissiveMap, $UV).$CH * material_emissiveIntensity;
}

