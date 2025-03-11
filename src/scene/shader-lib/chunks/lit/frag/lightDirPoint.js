export default /* glsl */`
void evalOmniLight(vec3 lightPosW, out vec3 lightDirW, out vec3 lightDirNormW) {
    lightDirW = vPositionW - lightPosW;
    lightDirNormW = normalize(lightDirW);
}
`;
