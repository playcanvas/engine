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
    var clip = min(half(1.0), sqrt(max(half(0.0), log(min(alpha, half(1.0)) / alphaClipValue))) * half(0.5));
    if (alpha > half(1.0)) {
        // over-unity opacity: the plain trim at peak 1, stretched past the opaque core (see gsplatHelpersVS)
        let core = gsplatPlateauCore(f32(alpha));
        clip = half(core + (1.0 - core) * f32(clip));
    }
    corner.offset = corner.offset * f32(clip);
    corner.uv = corner.uv * clip;
}
`;
