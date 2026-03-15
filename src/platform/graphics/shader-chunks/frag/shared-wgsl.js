export default /* glsl */`

#define WEBGPU

// convert clip space position into texture coordinates for sampling scene grab textures
fn getGrabScreenPos(clipPos: vec4<f32>) -> vec2<f32> {
    var uv: vec2<f32> = (clipPos.xy / clipPos.w) * 0.5 + vec2<f32>(0.5);
    uv.y = 1.0 - uv.y;
    return uv;
}

// convert uv coordinates to sample image effect texture (render target texture rendered without
// forward renderer which does the flip in the projection matrix)
fn getImageEffectUV(uv: vec2<f32>) -> vec2<f32> {
    var modifiedUV: vec2<f32> = uv;
    modifiedUV.y = 1.0 - modifiedUV.y;
    return modifiedUV;
}

// types wrapped in size aligned structures to ensure correct alignment in uniform buffer arrays
struct WrappedF32 { @size(16) element: f32 }
struct WrappedI32 { @size(16) element: i32 }
struct WrappedU32 { @size(16) element: u32 }
struct WrappedVec2F { @size(16) element: vec2f }
struct WrappedVec2I { @size(16) element: vec2i }
struct WrappedVec2U { @size(16) element: vec2u }
`;
