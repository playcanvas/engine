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

// modify the gaussian corner so it excludes gaussian regions with alpha less than 1/255
fn clipCorner(corner: ptr<function, SplatCorner>, alpha: half) {
    let clip = min(half(1.0), sqrt(-log(half(1.0) / (half(255.0) * alpha))) / half(2.0));
    corner.offset = corner.offset * f32(clip);
    corner.uv = corner.uv * clip;
}
`;
