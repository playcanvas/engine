export default /* wgsl */`
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
var<private> cornerPlateau: f32 = 1.0;
var<private> cornerGrow: f32 = 1.0;
#endif

#include "gsplatCornerVS"
#include "gsplatOutputVS"

#if defined(SHADOW_PASS) || defined(PICK_PASS) || defined(PREPASS_PASS)
uniform alphaClip: f32;
#else
uniform alphaClipForward: f32;
#endif

// modify the gaussian corner; uses alphaClip (non-forward) or alphaClipForward (forward) to match frag
fn clipCorner(corner: ptr<function, SplatCorner>, alpha: half) {
    #if defined(SHADOW_PASS) || defined(PICK_PASS) || defined(PREPASS_PASS)
        let alphaClipValue = half(uniform.alphaClip);
    #else
        let alphaClipValue = half(uniform.alphaClipForward);
    #endif
    var clip = min(half(1.0), sqrt(max(half(0.0), log(alpha / alphaClipValue))) * half(0.5));
    #ifdef GSPLAT_OVERUNITY
        if (cornerPlateau > 1.0) {
            // the plateau profile falls to alphaClip at (D'-1) + sqrt(2 ln(alpha / alphaClip) / D')
            // sigma, capped at its extent; uv keeps measuring distance in units of 2.83 sigma
            let edge = (cornerPlateau - 1.0) + sqrt(max(0.0, 2.0 * log(f32(alpha) / f32(alphaClipValue)) / cornerPlateau));
            clip = half(min(cornerGrow, edge / 2.8284271));
        }
    #endif
    corner.offset = corner.offset * f32(clip);
    corner.uv = corner.uv * clip;
}
`;
