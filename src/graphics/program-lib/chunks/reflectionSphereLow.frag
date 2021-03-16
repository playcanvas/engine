uniform sampler2D texture_sphereMap;
uniform MEDP float material_reflectivity;

vec3 calcReflection(vec3 tReflDirW, float tGlossiness) {
    MEDP vec3 reflDirV = vNormalV;

    MEDP vec2 sphereMapUv = reflDirV.xy * 0.5 + 0.5;
    return $texture2DSAMPLE(texture_sphereMap, sphereMapUv).rgb;
}

void addReflection() {   
    dReflection += vec4(calcReflection(dReflDirW, dGlossiness), material_reflectivity);
}
