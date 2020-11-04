vec3 cubeMapProject(vec3 dir) {
#ifdef CUBEMAPROT
    return dir*cubeMapRotationMatrix;
#else
    return dir;
#endif
}
