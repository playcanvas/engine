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

    #include "litUserMainStartPS"

    var output: FragmentOutput;
    
    evaluateFrontend();

    #ifdef PICK_PASS
        output.color = getPickOutput();
        #ifdef DEPTH_PICK_PASS
            output.color1 = getPickDepth();
        #endif
        #ifdef NORMAL_PICK_PASS
            // world-space interpolated vertex normal. The normal-pick pass forces needsNormal,
            // so the NORMALS varying (vNormalW) is always generated. getPickNormal normalizes,
            // so the raw interpolated value is fine. Note: this is the geometric surface normal,
            // not the normal-mapped one - sufficient for pick-point orientation.
            output.color2 = getPickNormal(vNormalW);
        #endif
    #endif

    #ifdef PREPASS_PASS
        output.color = float2vec4(vLinearDepth);
    #endif

    #include "litUserMainEndPS"

    return output;
}
`;
