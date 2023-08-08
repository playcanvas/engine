export default /* glsl */`

// convert clip space position into texture coordinates to sample scene grab textures
vec2 getGrabScreenPos(vec4 clipPos) {
    vec2 uv = (clipPos.xy / clipPos.w) * 0.5 + 0.5;

    #ifdef WEBGPU
        uv.y = 1.0 - uv.y;
    #endif

    return uv;
}

// convert uv coordinates to sample image effect texture (render target texture rendered without
// forward renderer which does the flip in the projection matrix)
vec2 getImageEffectUV(vec2 uv) {
    #ifdef WEBGPU
        uv.y = 1.0 - uv.y;
    #endif

    return uv;
}
`;
