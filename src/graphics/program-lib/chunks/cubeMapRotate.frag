#ifdef CUBEMAPROT
uniform mat3 cubeMapRotationMatrix;
#endif

vec3 cubeMapRotateNegX(vec3 refDir) {
#ifdef CUBEMAPROT
    return refDir * cubeMapRotationMatrix;
#else
    return vec3(-refDir.x, refDir.yz);
#endif
}

vec3 cubeMapRotatePosX(vec3 refDir) {
#ifdef CUBEMAPROT
    return (refDir * cubeMapRotationMatrix) * vec3(-1, 1, 1);
#else
    return refDir;
#endif
}