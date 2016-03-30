uniform sampler2D texture_sphereMap;
uniform float material_reflectivity;
void addReflection() {

    vec3 reflDirV = vNormalV;

    vec2 sphereMapUv = reflDirV.xy * 0.5 + 0.5;
    dReflection += vec4($texture2DSAMPLE(texture_sphereMap, sphereMapUv).rgb, material_reflectivity);
}

