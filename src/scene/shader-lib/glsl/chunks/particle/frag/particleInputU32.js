export default /* glsl */`
// Reads particle state from an RGBA32U integer texture, storing exact float bits.
// Used as the fallback when float textures are not renderable (some WebGL2 devices
// lacking EXT_color_buffer_float). The layout matches particleInputFloat exactly.
void readInput(float uv) {
    uvec4 tex = texture2D(particleTexIN, vec2(uv, 0.25));
    uvec4 tex2 = texture2D(particleTexIN, vec2(uv, 0.75));

    inPos = uintBitsToFloat(tex.xyz);
    inVel = uintBitsToFloat(tex2.xyz);

    float w = uintBitsToFloat(tex.w);
    inAngle = (w < 0.0 ? -w : w) - 1000.0;
    inShow = w >= 0.0;
    inLife = uintBitsToFloat(tex2.w);
}
`;
