uniform mat3 cubeMapRotationMatrix;

vec3 cubeMapProject(vec3 dir) {
    return dir*cubeMapRotationMatrix;
}
