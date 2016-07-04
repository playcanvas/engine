vec3 getCookie2D(sampler2D tex, mat4 transform) {
    return vec3(1.0);
}

vec3 getCookieCube(samplerCube tex, mat4 transform) {
    return textureCube(tex, dLightDirNormW * mat3(transform)).rgb;
}

