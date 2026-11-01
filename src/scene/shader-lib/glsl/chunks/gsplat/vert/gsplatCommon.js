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

#ifdef GSPLAT_OVERUNITY
// the current splat's over-unity plateau shape D' (1 = plain gaussian), and the factor by which
// its extent, (D'-1) + 2.83 / sqrt(D') sigma, exceeds the gaussian's 2.83 sigma. Set before
// initCorner, which culls by the grown footprint.
float cornerPlateau = 1.0;
float cornerGrow = 1.0;
#endif

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
    #ifdef GSPLAT_OVERUNITY
        if (cornerPlateau > 1.0) {
            // the plateau profile falls to alphaClip at (D'-1) + sqrt(2 ln(alpha / alphaClip) / D')
            // sigma, capped at its extent; uv keeps measuring distance in units of 2.83 sigma
            float edge = (cornerPlateau - 1.0) + sqrt(max(0.0, 2.0 * log(alpha / alphaClipValue) / cornerPlateau));
            clip = min(cornerGrow, edge / 2.8284271);
        }
    #endif
    corner.offset *= clip;
    corner.uv *= clip;
}
`;
