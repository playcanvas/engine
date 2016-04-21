uniform samplerCube texture_cubeMap;
uniform float material_reflectivity;
void addReflection() {
    vec3 lookupVec = fixSeams(cubeMapProject(dReflDirW));
    lookupVec.x *= -1.0;
    dReflection += vec4($textureCubeSAMPLE(texture_cubeMap, lookupVec).rgb, material_reflectivity);
}
