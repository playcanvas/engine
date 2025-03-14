export default /* glsl */`

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
`;
