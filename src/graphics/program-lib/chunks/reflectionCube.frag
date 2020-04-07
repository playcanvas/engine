uniform samplerCube texture_cubeMap;
uniform float material_reflectivity;
#ifdef CLEARCOAT
    uniform float material_clear_coat_reflectivity;
#endif
void addReflection() {
    vec3 lookupVec = fixSeams(cubeMapProject(dReflDirW));
    lookupVec.x *= -1.0;
    dReflection += vec4($textureCubeSAMPLE(texture_cubeMap, lookupVec).rgb, material_reflectivity);
    #ifdef CLEARCOAT
        lookupVec = fixSeams(cubeMapProject(ccReflDirW));
        lookupVec.x *= -1.0;
        ccReflection += vec4($textureCubeSAMPLE(texture_cubeMap, lookupVec).rgb, material_clear_coat_reflectivity);
    #endif   
}
