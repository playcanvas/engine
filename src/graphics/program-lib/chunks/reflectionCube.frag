uniform samplerCube texture_cubeMap;
uniform float material_reflectivity;

vec3 calcReflection(vec3 tReflDirW, float tGlossiness) {
    vec3 lookupVec = fixSeams(cubeMapProject(tReflDirW));
#ifndef RIGHT_HANDED_CUBEMAP
    lookupVec.x *= -1.0;
#endif
    return $textureCubeSAMPLE(texture_cubeMap, lookupVec).rgb;
}

void addReflection() {   
    dReflection += vec4(calcReflection(dReflDirW, dGlossiness), material_reflectivity);
}
