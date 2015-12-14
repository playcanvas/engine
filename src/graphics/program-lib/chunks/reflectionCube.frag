uniform samplerCube texture_cubeMap;
uniform float material_reflectivity;
void addReflection(inout psInternalData data) {
    vec3 lookupVec = fixSeams(cubeMapProject(data.reflDirW));
    lookupVec.x *= -1.0;
    data.reflection += vec4($textureCubeSAMPLE(texture_cubeMap, lookupVec).rgb, material_reflectivity);
}
