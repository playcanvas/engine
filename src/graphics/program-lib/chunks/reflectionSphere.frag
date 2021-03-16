#ifndef VIEWMATRIX
#define VIEWMATRIX
uniform mat4 matrix_view;
#endif
uniform sampler2D texture_sphereMap;
uniform MEDP float material_reflectivity;

vec3 calcReflection(vec3 tReflDirW, float tGlossiness) {
    MEDP vec3 reflDirV = (mat3(matrix_view) * tReflDirW).xyz;

    MEDP float m = 2.0 * sqrt( dot(reflDirV.xy, reflDirV.xy) + (reflDirV.z+1.0)*(reflDirV.z+1.0) );
    MEDP vec2 sphereMapUv = reflDirV.xy / m + 0.5;

    return $texture2DSAMPLE(texture_sphereMap, sphereMapUv).rgb;
}

void addReflection() {   
    dReflection += vec4(calcReflection(dReflDirW, dGlossiness), material_reflectivity);
}
