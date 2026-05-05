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

uniform float alphaCull;

// modify the gaussian corner so it excludes gaussian regions below alphaCull (forward pass)
void clipCorner(inout SplatCorner corner, float alpha) {
    float clip = min(1.0, sqrt(max(0.0, log(alpha / alphaCull))) * 0.5);
    corner.offset *= clip;
    corner.uv *= clip;
}
`;
