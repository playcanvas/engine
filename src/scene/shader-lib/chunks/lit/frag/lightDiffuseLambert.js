export default /* glsl */`
float getLightDiffuse(vec3 worldNormal, vec3 viewDir) {
    return max(dot(worldNormal, -dLightDirNormW), 0.0);
}
`;
