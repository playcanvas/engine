uniform uTime: f32;
uniform uShine: f32;
uniform uHue: f32;
uniform uWaves: f32;
uniform uView: f32;

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
    let logo = getBlind_logo();
    let edge = getBlind_edge();
    var rgb = (*color).rgb;
    if (uniform.uView > 1.5) {
        // the 'edge' field as grays
        rgb = vec3f(edge);
    } else if (uniform.uView > 0.5) {
        // the 'logo' field: white where it is set
        rgb = select(vec3f(0.3), vec3f(1.0), logo == 1u);
    } else if (logo == 1u) {
        // a silver logo (gray, as its walls pick up orange from the pillow), with golden bands
        // sweeping diagonally across it, spaced so one is always on the logo
        let silver = dot(rgb, vec3f(0.299, 0.587, 0.114)) * 0.6;
        let band = fract(dot(center.xy, vec2f(0.42)) - uniform.uTime * 0.4) - 0.5;
        let glint = uniform.uShine * exp(-band * band * 60.0);
        rgb = vec3f(silver * max(1.0 - glint, 0.0)) + glint * vec3f(1.0, 0.65, 0.15);
    } else {
        // recolor the pillow, with hue waves running out from the logo outline
        let wave = uniform.uWaves * sin(edge * 30.0 - uniform.uTime * 3.0) * (1.0 - edge);
        rgb = hueRotate(rgb, uniform.uHue + wave);
    }
    *color = vec4f(rgb, (*color).a);
}
