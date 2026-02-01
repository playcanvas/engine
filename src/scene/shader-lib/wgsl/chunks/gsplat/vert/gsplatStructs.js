export default /* wgsl */`

// Shared splat identification (index, uv) and setSplat() helper
#include "gsplatSplatVS"

// stores the render order and corner for this vertex
struct SplatSource {
    order: u32,         // render order
    cornerUV: vec2f     // corner coordinates for this vertex of the gaussian (-1, -1)..(1, 1)
}

// stores the camera and clip space position of the gaussian center
struct SplatCenter {
    view: vec3f,          // center in view space
    proj: vec4f,          // center in clip space
    modelView: mat4x4f,   // model-view matrix
    projMat00: f32,       // element [0][0] of the projection matrix
    modelCenterOriginal: vec3f,   // original model center before modification
    modelCenterModified: vec3f,   // model center after modification
}

// stores the offset from center for the current gaussian
struct SplatCorner {
    offset: vec3f,        // corner offset (clip XY for 3DGS, model XYZ for 2DGS)
    uv: vec2f,            // corner uv
    #if GSPLAT_AA
        aaFactor: f32, // for scenes generated with antialiasing
    #endif
}

`;
