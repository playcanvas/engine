uniform PMEDP float exposure;

vec3 toneMap(vec3 color) {
    return color * exposure;
}
