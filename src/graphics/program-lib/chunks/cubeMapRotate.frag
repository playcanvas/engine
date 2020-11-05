#ifdef CUBEMAPROT
uniform mat3 cubeMapRotationMatrix;
#endif

vec3 cubeMapRotate0(vec3 refDir) {
#ifdef CUBEMAPROT
    return refDir*cubeMapRotationMatrix;
#else
    return refDir * vec3(-1, 1, 1);
#endif
}

vec3 cubeMapRotate1(vec3 refDir) {
#ifdef CUBEMAPROT
    return (refDir*cubeMapRotationMatrix) * vec3(-1, 1, 1);
#else
    return refDir;
#endif
}