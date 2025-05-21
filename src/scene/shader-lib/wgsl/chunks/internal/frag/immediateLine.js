export default /* wgsl */`
    #include "gammaPS"
    varying color: vec4f;
    @fragment
    fn fragmentMain(input : FragmentInput) -> FragmentOutput {
        var output: FragmentOutput;
        output.color = vec4f(gammaCorrectOutput(decodeGamma3(input.color.rgb)), input.color.a);
        return output;
    }
`;
