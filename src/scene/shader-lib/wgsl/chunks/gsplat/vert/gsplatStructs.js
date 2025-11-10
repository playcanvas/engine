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
    projMat00: f32,       // element [0][0] of the projection matrix
    modelCenterOriginal: vec3f,   // original model center before modification
    modelCenterModified: vec3f,   // model center after modification
}

// stores the offset from center for the current gaussian
struct SplatCorner {
    offset: vec2f,        // corner offset from center in clip space
    uv: vec2f,            // corner uv
    #if GSPLAT_AA
        aaFactor: f32, // for scenes generated with antialiasing
    #endif
}

`;
