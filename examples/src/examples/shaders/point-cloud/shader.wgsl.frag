varying outColor: vec4f;

@fragment
fn fragmentMain(input: FragmentInput) -> FragmentOutput {
    var output: FragmentOutput;

    // just output color supplied by vertex shader
    output.color = input.outColor;
    return output;
}
