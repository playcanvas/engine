uniform float skyboxIntensity;
vec3 processEnvironment(vec3 color) {
    return color * skyboxIntensity;
}

