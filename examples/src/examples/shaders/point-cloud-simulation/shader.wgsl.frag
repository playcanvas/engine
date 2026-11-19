varying outColor: vec4f;

@fragment
fn fragmentMain(input: FragmentInput) -> FragmentOutput {
    var output: FragmentOutput;

    // color supplied by vertex shader (WebGPU points are a single pixel, so they are not rounded)
    output.color = input.outColor;
    return output;
}
