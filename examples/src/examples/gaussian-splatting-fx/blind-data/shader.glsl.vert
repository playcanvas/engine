uniform float uTime;
uniform float uShine;
uniform float uHue;
uniform float uWaves;

// rotates a color around the gray axis
vec3 hueRotate(vec3 c, float angle) {
    const vec3 k = vec3(0.57735027);
    float cosA = cos(angle);
    return c * cosA + cross(k, c) * sin(angle) + k * dot(k, c) * (1.0 - cosA);
}

void modifySplatCenter(inout vec3 center) {
}

void modifySplatRotationScale(vec3 originalCenter, vec3 modifiedCenter, inout vec4 rotation, inout vec3 scale) {
}

void modifySplatColor(vec3 center, inout vec4 color) {
    if (getBlind_logo() == 1u) {
        // a silver logo, with bright bands sweeping diagonally across it, spaced so one is
        // always on the logo
        float band = fract(dot(center.xy, vec2(0.42)) - uTime * 0.4) - 0.5;
        color.rgb = color.rgb * 0.6 + uShine * exp(-band * band * 60.0);
    } else {
        // recolor the pillow, with hue waves running out from the logo outline
        float edge = getBlind_edge();
        float wave = uWaves * sin(edge * 30.0 - uTime * 3.0) * (1.0 - edge);
        color.rgb = hueRotate(color.rgb, uHue + wave);
    }
}
