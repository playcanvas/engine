// main shader entry point for the lit material for other render passes
export default /* glsl */`

#ifdef PICK_PASS
    #include "pickPS"
#endif

#ifdef PREPASS_PASS
    #include "floatAsUintPS"
#endif

void main(void) {

    #include "litUserMainStartPS"

    evaluateFrontend();

    #ifdef PICK_PASS
        pcFragColor0 = getPickOutput();
        #ifdef DEPTH_PICK_PASS
            pcFragColor1 = getPickDepth();
        #endif
        #ifdef NORMAL_PICK_PASS
            // world-space interpolated vertex normal. The normal-pick pass forces needsNormal,
            // so the NORMALS varying (vNormalW) is always generated. getPickNormal normalizes,
            // so the raw interpolated value is fine. Note: this is the geometric surface normal,
            // not the normal-mapped one - sufficient for pick-point orientation.
            pcFragColor2 = getPickNormal(vNormalW);
        #endif
    #endif

    #ifdef PREPASS_PASS
        gl_FragColor = float2vec4(vLinearDepth);
    #endif

    #include "litUserMainEndPS"
}
`;
