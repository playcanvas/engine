#ifndef VIEWMATRIX
#define VIEWMATRIX
uniform mat4 matrix_view;
#endif
uniform sampler2D texture_sphereMap;
vec3 calcReflection(vec3 tReflDirW, float tGlossiness) {
    vec3 reflDirV = (mat3(matrix_view) * tReflDirW).xyz;

    float m = 2.0 * sqrt( dot(reflDirV.xy, reflDirV.xy) + (reflDirV.z+1.0)*(reflDirV.z+1.0) );
    vec2 sphereMapUv = reflDirV.xy / m + 0.5;

    return $texture2DSAMPLE(texture_sphereMap, sphereMapUv).rgb;
}

uniform float material_reflectivity;
void addReflection() {   
    dReflection += vec4(calcReflection(dReflDirW, dGlossiness), material_reflectivity);
}
