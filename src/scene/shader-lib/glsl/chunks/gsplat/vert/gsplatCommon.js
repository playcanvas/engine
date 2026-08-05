export default /* glsl */`
#include "gsplatHelpersVS"
#include "gsplatFormatVS"
#include "gsplatStructsVS"
#include "gsplatDeclarationsVS"
#include "gsplatModifyVS"
#include "gsplatEvalSHVS"
#include "gsplatQuatToMat3VS"
#include "gsplatReadVS"
#include "gsplatSourceVS"
#include "gsplatCenterVS"
#include "gsplatCornerVS"
#include "gsplatOutputVS"

#if defined(SHADOW_PASS) || defined(PICK_PASS) || defined(PREPASS_PASS)
uniform float alphaClip;
#else
uniform float alphaClipForward;
#endif

// modify the gaussian corner; uses alphaClip (non-forward) or alphaClipForward (forward) to match frag
void clipCorner(inout SplatCorner corner, float alpha) {
    #if defined(SHADOW_PASS) || defined(PICK_PASS) || defined(PREPASS_PASS)
        float alphaClipValue = alphaClip;
    #else
        float alphaClipValue = alphaClipForward;
    #endif
    float clip = min(1.0, sqrt(max(0.0, log(alpha / alphaClipValue))) * 0.5);
    corner.offset *= clip;
    corner.uv *= clip;
}
`;
