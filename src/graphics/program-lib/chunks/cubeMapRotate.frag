#ifdef CUBEMAPROT
uniform mat3 cubeMapRotationMatrix;
#endif

vec3 cubeMapRotate(vec3 refDir) {
#ifdef CUBEMAPROT
    return refDir * cubeMapRotationMatrix;
#else
    return refDir;
#endif
}
