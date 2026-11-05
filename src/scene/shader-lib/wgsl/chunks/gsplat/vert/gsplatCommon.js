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
    #ifdef GSPLAT_OVERUNITY
        // alpha above 1 is drawn with peak 1 and the plateau profile (see gsplatHelpersVS)
        let clip = half(gsplatPlateauClip(gsplatPlateauShape(f32(alpha)), min(f32(alpha), 1.0), f32(alphaClipValue)));
    #else
        let clip = min(half(1.0), sqrt(max(half(0.0), log(alpha / alphaClipValue))) * half(0.5));
    #endif
    corner.offset = corner.offset * f32(clip);
    corner.uv = corner.uv * clip;
}
`;
