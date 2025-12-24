export default /* wgsl */`
fn encodeLinear(source: vec3f) -> vec4f {
    return vec4f(source, 1.0);
}

fn encodeGamma(source: vec3f) -> vec4f {
    return vec4f(pow(source + vec3f(0.0000001), vec3f(1.0 / 2.2)), 1.0);
}

fn encodeRGBM(source: vec3f) -> vec4f {
    var color: vec3f = pow(source, vec3f(0.5));
    color *= 1.0 / 8.0;

    var a: f32 = saturate(max(max(color.r, color.g), max(color.b, 1.0 / 255.0)));
    a = ceil(a * 255.0) / 255.0;

    color /= a;
    return vec4f(color, a);
}

fn encodeRGBP(source: vec3f) -> vec4f {
    // convert incoming linear to gamma(ish)
    var gamma: vec3f = pow(source, vec3f(0.5));

    // calculate the maximum component clamped to 1..8
    var maxVal: f32 = min(8.0, max(1.0, max(gamma.x, max(gamma.y, gamma.z))));

    // calculate storage factor
    var v: f32 = 1.0 - ((maxVal - 1.0) / 7.0);

    // round the value for storage in 8bit channel
    v = ceil(v * 255.0) / 255.0;

    return vec4f(gamma / (-v * 7.0 + 8.0), v);
}

fn encodeRGBE(source: vec3f) -> vec4f {
    var maxVal: f32 = max(source.x, max(source.y, source.z));
    if (maxVal < 1e-32) {
        return vec4f(0.0, 0.0, 0.0, 0.0);
    } else {
        var e: f32 = ceil(log2(maxVal));
        return vec4f(source / pow(2.0, e), (e + 128.0) / 255.0);
    }
}
`;
