vec3 detailBlend_mul(vec3 c1, vec3 c2) {
    return c1 * c2;
}

vec3 detailBlend_add(vec3 c1, vec3 c2) {
    return c1 + c2;
}

// https://en.wikipedia.org/wiki/Blend_modes#Screen
vec3 detailBlend_screen(vec3 c1, vec3 c2) {
    return 1.0 - (1.0 - c1)*(1.0 - c2);
}

// https://en.wikipedia.org/wiki/Blend_modes#Overlay
vec3 detailBlend_overlay(vec3 c1, vec3 c2) {
    return mix(1.0 - 2.0*(1.0 - c1)*(1.0 - c2), 2.0*c1*c2, step(c1, vec3(0.5)));
}

vec3 detailBlend_min(vec3 c1, vec3 c2) {
    return min(c1, c2);
}

vec3 detailBlend_max(vec3 c1, vec3 c2) {
    return max(c1, c2);
}

