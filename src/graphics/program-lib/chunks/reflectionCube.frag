uniform samplerCube texture_cubeMap;
uniform float material_reflectivity;
#ifdef CLEARCOAT
    uniform float material_clearCoatReflectivity;
#endif
vec4 calcReflection(vec3 tReflDirW, float tGlossiness, float tmaterial_reflectivity) {
    vec3 lookupVec = fixSeams(cubeMapProject(tReflDirW));
    lookupVec.x *= -1.0;
    return vec4($textureCubeSAMPLE(texture_cubeMap, lookupVec).rgb, tmaterial_reflectivity);
}
