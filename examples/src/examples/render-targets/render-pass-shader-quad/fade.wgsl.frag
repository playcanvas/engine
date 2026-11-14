// The light removed from the canvas. With the reverse subtract blending of the pass, the canvas
// becomes: canvas * (1 - uFade.a) - uFade.rgb. The alpha removes a fraction of the light, which
// fades the trails smoothly, and the color a small constant amount, which fades them out fully.
uniform uFade: vec4f;

@fragment
fn fragmentMain(input: FragmentInput) -> FragmentOutput {
    var output: FragmentOutput;
    output.color = uniform.uFade;
    return output;
}
