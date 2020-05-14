uniform samplerCube texture_cubeMap;
vec3 calcReflection(vec3 tReflDirW, float tGlossiness) {
    vec3 lookupVec = fixSeams(cubeMapProject(tReflDirW));
    lookupVec.x *= -1.0;
    return $textureCubeSAMPLE(texture_cubeMap, lookupVec).rgb;
}

uniform float material_reflectivity;
void addReflection() {   
    dReflection += vec4(calcReflection(dReflDirW, dGlossiness), material_reflectivity);
}
