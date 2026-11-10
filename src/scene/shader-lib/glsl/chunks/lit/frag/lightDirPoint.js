export default /* glsl */`
vec3 evalOmniLight(vec3 lightPosW) {
    return litArgs_worldPosition - lightPosW;
}
`;
