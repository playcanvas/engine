uniform uTime: f32;
uniform uShine: f32;
uniform uHue: f32;
uniform uWaves: f32;

// rotates a color around the gray axis
fn hueRotate(c: vec3f, angle: f32) -> vec3f {
    let k = vec3f(0.57735027);
    let cosA = cos(angle);
    return c * cosA + cross(k, c) * sin(angle) + k * dot(k, c) * (1.0 - cosA);
}

fn modifySplatCenter(center: ptr<function, vec3f>) {
}

fn modifySplatRotationScale(originalCenter: vec3f, modifiedCenter: vec3f, rotation: ptr<function, vec4f>, scale: ptr<function, vec3f>) {
}

fn modifySplatColor(center: vec3f, color: ptr<function, vec4f>) {
    var rgb = (*color).rgb;
    if (getBlind_logo() == 1u) {
        // a silver logo, with bright bands sweeping diagonally across it, spaced so one is
        // always on the logo
        let band = fract(dot(center.xy, vec2f(0.42)) - uniform.uTime * 0.4) - 0.5;
        rgb = rgb * 0.6 + uniform.uShine * exp(-band * band * 60.0);
    } else {
        // recolor the pillow, with hue waves running out from the logo outline
        let edge = getBlind_edge();
        let wave = uniform.uWaves * sin(edge * 30.0 - uniform.uTime * 3.0) * (1.0 - edge);
        rgb = hueRotate(rgb, uniform.uHue + wave);
    }
    *color = vec4f(rgb, (*color).a);
}
