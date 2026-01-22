export default /* wgsl */`
#include "gsplatHelpersVS"
#include "gsplatFormatVS"
#include "gsplatDeclarationsVS"
#include "gsplatCustomizeVS"
#include "gsplatModifyVS"

#include "gsplatStructsVS"
#include "gsplatEvalSHVS"
#include "gsplatQuatToMat3VS"
#include "gsplatReadVS"
#include "gsplatSourceVS"
#include "gsplatCenterVS"
#include "gsplatCornerVS"
#include "gsplatOutputVS"

// modify the gaussian corner so it excludes gaussian regions with alpha less than 1/255
fn clipCorner(corner: ptr<function, SplatCorner>, alpha: f32) {
    let clip: f32 = min(1.0, sqrt(-log(1.0 / (255.0 * alpha))) / 2.0);
    corner.offset = corner.offset * clip;
    corner.uv = corner.uv * clip;
}
`;
