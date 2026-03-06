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

// modify the gaussian corner so it excludes gaussian regions with alpha less than 1/255
void clipCorner(inout SplatCorner corner, float alpha) {
    float clip = min(1.0, sqrt(log(255.0 * alpha)) * 0.5);
    corner.offset *= clip;
    corner.uv *= clip;
}
`;
