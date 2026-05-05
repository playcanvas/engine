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

uniform alphaCull: f32;

// modify the gaussian corner so it excludes gaussian regions below alphaCull (forward pass)
fn clipCorner(corner: ptr<function, SplatCorner>, alpha: half) {
    let clip = min(half(1.0), sqrt(max(half(0.0), log(alpha / half(uniform.alphaCull)))) * half(0.5));
    corner.offset = corner.offset * f32(clip);
    corner.uv = corner.uv * clip;
}
`;
