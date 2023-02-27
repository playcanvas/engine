export default /* glsl */`
float getLightDiffuse(Frontend frontend) {
    return max(dot(frontend.worldNormal, -dLightDirNormW), 0.0);
}
`;
