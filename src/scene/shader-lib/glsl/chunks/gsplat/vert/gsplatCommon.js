export default /* glsl */`
#include "gsplatHelpersVS"
#include "gsplatCustomizeVS"
#include "gsplatModifyVS"

#include "gsplatStructsVS"
#include "gsplatEvalSHVS"
#include "gsplatQuatToMat3VS"
#include "gsplatFormatVS"
#include "gsplatReadVS"
#include "gsplatSourceVS"
#include "gsplatCenterVS"
#include "gsplatCornerVS"
#include "gsplatOutputVS"

// modify the gaussian corner so it excludes gaussian regions with alpha less than 1/255
void clipCorner(inout SplatCorner corner, float alpha) {
    float clip = min(1.0, sqrt(-log(1.0 / (255.0 * alpha))) / 2.0);
    corner.offset *= clip;
    corner.uv *= clip;
}
`;
