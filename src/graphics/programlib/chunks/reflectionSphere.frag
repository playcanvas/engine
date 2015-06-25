uniform mat4 matrix_view;
uniform sampler2D texture_sphereMap;
uniform float material_reflectivity;
void addReflection(inout psInternalData data) {

    vec3 reflDirV = (mat3(matrix_view) * data.reflDirW).xyz;

    float m = 2.0 * sqrt( dot(reflDirV.xy, reflDirV.xy) + (reflDirV.z+1.0)*(reflDirV.z+1.0) );
    vec2 sphereMapUv = reflDirV.xy / m + 0.5;

    data.reflection += vec4($texture2DSAMPLE(texture_sphereMap, sphereMapUv).rgb, material_reflectivity);
}


