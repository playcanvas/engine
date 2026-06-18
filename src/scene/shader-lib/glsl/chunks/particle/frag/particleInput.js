export default /* glsl */`
// Reads particle state from the state texture. When float textures are renderable the texture is
// RGBA32F and the samples are used directly; otherwise it is RGBA32U storing the exact float bits,
// which are reinterpreted here. particleTexIN is declared as sampler2D / usampler2D to match.
void readInput(float uv) {
    #ifdef CAPS_TEXTURE_FLOAT_RENDERABLE
        vec4 tex = texture2D(particleTexIN, vec2(uv, 0.25));
        vec4 tex2 = texture2D(particleTexIN, vec2(uv, 0.75));
    #else
        vec4 tex = uintBitsToFloat(texture2D(particleTexIN, vec2(uv, 0.25)));
        vec4 tex2 = uintBitsToFloat(texture2D(particleTexIN, vec2(uv, 0.75)));
    #endif

    inPos = tex.xyz;
    inVel = tex2.xyz;
    inAngle = (tex.w < 0.0 ? -tex.w : tex.w) - 1000.0;
    inShow = tex.w >= 0.0;
    inLife = tex2.w;
}
`;
