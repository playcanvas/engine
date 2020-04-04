vec3 blendColors_mul(vec3 c1, vec3 c2) {
    return c1 * c2;
}

vec3 blendColors_add(vec3 c1, vec3 c2) {
    return c1 + c2;
}

vec3 blendColors_screen(vec3 c1, vec3 c2) {
    return 1.0 - (1.0 - c1)*(1.0 - c2);
}

vec3 blendColors_overlay(vec3 c1, vec3 c2) {
    return mix(1.0 - 2.0*(1.0 - c1)*(1.0 - c2), 2.0*c1*c2, step(c1, vec3(0.5)));
}

vec3 blendColors_min(vec3 c1, vec3 c2) {
    return min(c1, c2);
}

vec3 blendColors_max(vec3 c1, vec3 c2) {
    return max(c1, c2);
}

