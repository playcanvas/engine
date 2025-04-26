export default /* glsl */`
uniform uint meshInstanceId;

vec4 getPickOutput() {
    const vec4 inv = vec4(1.0 / 255.0);
    const uvec4 shifts = uvec4(16, 8, 0, 24);
    uvec4 col = (uvec4(meshInstanceId) >> shifts) & uvec4(0xff);
    return vec4(col) * inv;
}
`;
