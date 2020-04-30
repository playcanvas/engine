uniform sampler2D texture_sphereMap;

vec4 calcReflection(vec3 tReflDirW, float tGlossiness, float tmaterial_reflectivity) {
    vec3 reflDirV = vNormalV;

    vec2 sphereMapUv = reflDirV.xy * 0.5 + 0.5;
    return vec4($texture2DSAMPLE(texture_sphereMap, sphereMapUv).rgb, tmaterial_reflectivity);      
}

uniform float material_reflectivity;
void addReflection() {   
    dReflection += calcReflection(dReflDirW, dGlossiness, material_reflectivity);
}

