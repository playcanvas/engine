varying color: vec4f;

@fragment
fn fragmentMain(input : FragmentInput) -> FragmentOutput {
    var output: FragmentOutput;
    output.color = input.color;
    return output;
}
