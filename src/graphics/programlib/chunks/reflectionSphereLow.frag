uniform sampler2D texture_sphereMap;
uniform float material_reflectivity;
void addReflection(inout psInternalData data) {

    vec3 reflDirV = vNormalV;

    vec2 sphereMapUv = reflDirV.xy * 0.5 + 0.5;
    data.reflection += vec4($texture2DSAMPLE(texture_sphereMap, sphereMapUv).rgb, material_reflectivity);
}

