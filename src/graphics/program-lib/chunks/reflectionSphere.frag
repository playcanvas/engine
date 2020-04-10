#ifndef VIEWMATRIX
#define VIEWMATRIX
uniform mat4 matrix_view;
#endif
uniform sampler2D texture_sphereMap;
vec4 calcReflection(vec3 tReflDirW, float tGlossiness, float tmaterial_reflectivity) {
    vec3 reflDirV = (mat3(matrix_view) * tReflDirW).xyz;

    float m = 2.0 * sqrt( dot(reflDirV.xy, reflDirV.xy) + (reflDirV.z+1.0)*(reflDirV.z+1.0) );
    vec2 sphereMapUv = reflDirV.xy / m + 0.5;

    return vec4($texture2DSAMPLE(texture_sphereMap, sphereMapUv).rgb, tmaterial_reflectivity);
}
