// the color of the brush, and the brightness of a single dot
uniform uBrushColor: vec3f;
uniform uBrushIntensity: f32;

// the position within the viewport the quad covers
varying uv0: vec2f;

@fragment
fn fragmentMain(input: FragmentInput) -> FragmentOutput {
    var output: FragmentOutput;

    // the distance from the center of the dot, 1 at the edge of the viewport
    let dist = length(input.uv0 * 2.0 - 1.0);

    // a soft glow, with a white hot core
    var glow = 1.0 - smoothstep(0.0, 1.0, dist);
    glow *= glow;
    let core = 1.0 - smoothstep(0.0, 0.3, dist);

    // the color is premultiplied by the alpha, as the blend states of the pass expect
    let intensity = uniform.uBrushIntensity;
    let color = (uniform.uBrushColor * glow + vec3f(0.7 * core)) * intensity;
    output.color = vec4f(color, glow * intensity);
    return output;
}
