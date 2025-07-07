export default /* wgsl */`

// stores the source UV and order of the splat
struct SplatSource {
    order: u32,         // render order
    id: u32,            // splat id
    uv: vec2<i32>,      // splat uv
    cornerUV: vec2f,    // corner coordinates for this vertex of the gaussian (-1, -1)..(1, 1)
}

// stores the camera and clip space position of the gaussian center
struct SplatCenter {
    view: vec3f,          // center in view space
    proj: vec4f,          // center in clip space
    modelView: mat4x4f,   // model-view matrix
    projMat00: f32,       // elememt [0][0] of the projection matrix
}

// stores the offset from center for the current gaussian
struct SplatCorner {
    offset: vec2f,        // corner offset from center in clip space
    uv: vec2f,            // corner uv
    #if GSPLAT_AA
        aaFactor: f32, // for scenes generated with antialiasing
    #endif
}

#include "gsplatEvalSHVS"
#include "gsplatQuatToMat3VS"
#include "gsplatSourceFormatVS"
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
