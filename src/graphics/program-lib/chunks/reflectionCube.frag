uniform samplerCube texture_cubeMap;
vec4 calcReflection(vec3 tReflDirW, float tGlossiness, float tmaterial_reflectivity) {
    vec3 lookupVec = fixSeams(cubeMapProject(tReflDirW));
    lookupVec.x *= -1.0;
    return vec4($textureCubeSAMPLE(texture_cubeMap, lookupVec).rgb, tmaterial_reflectivity);
}

uniform float material_reflectivity;
void addReflection() {   
    dReflection += calcReflection(dReflDirW, dGlossiness, material_reflectivity);
}
