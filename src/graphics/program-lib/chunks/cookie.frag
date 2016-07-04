vec3 getCookie2D(sampler2D tex) {
    return vec3(1.0);
}

vec3 getCookieCube(samplerCube tex) {
    return textureCube(tex, dLightDirW).rgb;
}

