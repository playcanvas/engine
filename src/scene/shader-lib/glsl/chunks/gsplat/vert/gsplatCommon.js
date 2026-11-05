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
    #ifdef GSPLAT_OVERUNITY
        // alpha above 1 is drawn with peak 1 and the plateau profile (see gsplatHelpersVS)
        float clip = gsplatPlateauClip(gsplatPlateauShape(alpha), min(alpha, 1.0), alphaClipValue);
    #else
        float clip = min(1.0, sqrt(max(0.0, log(alpha / alphaClipValue))) * 0.5);
    #endif
    corner.offset *= clip;
    corner.uv *= clip;
}
`;
