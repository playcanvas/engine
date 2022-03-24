export default /* glsl */`
float getLightDiffuse() {
    return max(dot(dNormalW, -dLightDirNormW), 0.0);
}
`;
