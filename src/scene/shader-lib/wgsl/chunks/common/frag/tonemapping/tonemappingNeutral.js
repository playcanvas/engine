// https://modelviewer.dev/examples/tone-mapping
export default /* wgsl */`
uniform exposure: f32;

fn toneMap(col: vec3f) -> vec3f {
    var color = col * uniform.exposure;

    let startCompression = 0.8 - 0.04;
    let desaturation = 0.15;

    let x = min(color.r, min(color.g, color.b));
    let offset = select(0.04, x - 6.25 * x * x, x < 0.08);
    color -= vec3f(offset);

    let peak = max(color.r, max(color.g, color.b));
    if (peak < startCompression) {
        return color;
    }

    let d = 1.0 - startCompression;
    let newPeak = 1.0 - d * d / (peak + d - startCompression);
    color *= newPeak / peak;

    let g = 1.0 - 1.0 / (desaturation * (peak - newPeak) + 1.0);
    return mix(color, vec3f(newPeak), vec3f(g));
}
`;
