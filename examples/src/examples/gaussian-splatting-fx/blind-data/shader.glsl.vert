uniform float uTime;
uniform float uShine;
uniform float uHue;
uniform float uWaves;
uniform float uView;

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
    uint logo = getBlind_logo();
    float edge = getBlind_edge();
    if (uView > 1.5) {
        // the 'edge' field as grays
        color.rgb = vec3(edge);
    } else if (uView > 0.5) {
        // the 'logo' field: white where it is set
        color.rgb = logo == 1u ? vec3(1.0) : vec3(0.3);
    } else if (logo == 1u) {
        // a silver logo (gray, as its walls pick up orange from the pillow), with golden bands
        // sweeping diagonally across it, spaced so one is always on the logo
        float silver = dot(color.rgb, vec3(0.299, 0.587, 0.114)) * 0.6;
        float band = fract(dot(center.xy, vec2(0.42)) - uTime * 0.4) - 0.5;
        float glint = uShine * exp(-band * band * 60.0);
        color.rgb = vec3(silver * max(1.0 - glint, 0.0)) + glint * vec3(1.0, 0.65, 0.15);
    } else {
        // recolor the pillow, with hue waves running out from the logo outline
        float wave = uWaves * sin(edge * 30.0 - uTime * 3.0) * (1.0 - edge);
        color.rgb = hueRotate(color.rgb, uHue + wave);
    }
}
