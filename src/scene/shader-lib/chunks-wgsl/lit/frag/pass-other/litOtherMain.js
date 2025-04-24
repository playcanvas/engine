// main shader entry point for the lit material for other render passes
export default /* wgsl */`

#ifdef PICK_PASS
    #include "pickPS"
#endif

#ifdef PREPASS_PASS
    #include "floatAsUintPS"
#endif

@fragment
fn fragmentMain(input: FragmentInput) -> FragmentOutput {
    var output: FragmentOutput;
    
    evaluateFrontend();

    #ifdef PICK_PASS
        output.color = getPickOutput();
    #endif

    #ifdef DEPTH_PASS
        output.color = vec4(1.0, 1.0, 1.0, 1.0);
    #endif

    #ifdef PREPASS_PASS
        output.color = float2vec4(vLinearDepth);
    #endif

    return output;
}
`;
