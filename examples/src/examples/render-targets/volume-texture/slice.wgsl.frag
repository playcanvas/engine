// the normalized height of the depth slice rendered to
uniform uHeight: f32;
uniform uTime: f32;

varying uv0: vec2f;

fn hash(n: f32) -> f32 {
    return fract(sin(n) * 43758.5453);
}

// a fully saturated color of the specified hue (0..1)
fn hueToColor(hue: f32) -> vec3f {
    let h = vec3f(hue * 6.0) + vec3f(0.0, 4.0, 2.0);
    return clamp(abs(h - 6.0 * floor(h / 6.0) - 3.0) - 1.0, vec3f(0.0), vec3f(1.0));
}

@fragment
fn fragmentMain(input: FragmentInput) -> FragmentOutput {
    var output: FragmentOutput;

    // the position in the volume, x and z across the slice, y is its height
    let p = vec3f(input.uv0.x, uniform.uHeight, input.uv0.y);
    let time = uniform.uTime;

    // sum colorful blobs of fog drifting around, weighting their colors by their density
    var density = 0.0;
    var color = vec3f(0.0);
    for (var i = 0; i < 12; i++) {
        let fi = f32(i);
        var center = vec3f(hash(fi * 3.1 + 0.5), hash(fi * 5.7 + 1.3) * 0.6, hash(fi * 7.3 + 2.1));
        center.x += 0.15 * sin(time * 0.3 + fi * 1.7);
        center.z += 0.15 * cos(time * 0.23 + fi * 2.3);
        let radius = 0.12 + hash(fi * 11.1 + 3.7) * 0.15;
        var d = p - center;
        d.y *= 0.5;
        let weight = exp(-dot(d, d) / (radius * radius));
        density += weight;
        color += weight * hueToColor(fi / 12.0);
    }

    // break the blobs up with some wavy detail, and fade out the fog towards the top
    let detail = 0.6 + 0.4 * sin(p.x * 37.0 + sin(p.z * 23.0) + time) * sin(p.z * 31.0 + p.y * 11.0);
    let fade = (1.0 - p.y) * (1.0 - p.y);

    var rgb = vec3f(0.0);
    if (density > 0.0) {
        rgb = color / density;
    }
    output.color = vec4f(rgb, clamp(density * detail * fade, 0.0, 1.0));
    return output;
}
