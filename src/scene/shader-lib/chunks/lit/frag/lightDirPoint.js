export default /* glsl */`
vec3 evalOmniLight(vec3 lightPosW) {
    return vPositionW - lightPosW;
}
`;
