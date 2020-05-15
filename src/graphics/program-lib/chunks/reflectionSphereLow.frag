uniform sampler2D texture_sphereMap;

vec3 calcReflection(vec3 tReflDirW, float tGlossiness) {
    vec3 reflDirV = vNormalV;

    vec2 sphereMapUv = reflDirV.xy * 0.5 + 0.5;
    return $texture2DSAMPLE(texture_sphereMap, sphereMapUv).rgb;
}

uniform float material_reflectivity;
void addReflection() {   
    dReflection += vec4(calcReflection(dReflDirW, dGlossiness), material_reflectivity);
}
