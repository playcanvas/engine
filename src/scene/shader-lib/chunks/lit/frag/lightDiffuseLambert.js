export default /* glsl */`
float getLightDiffuse(vec3 worldNormal) {
    return max(dot(worldNormal, -dLightDirNormW), 0.0);
}
`;
