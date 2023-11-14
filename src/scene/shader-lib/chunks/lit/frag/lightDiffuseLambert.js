export default /* glsl */`
float getLightDiffuse(vec3 worldNormal, vec3 viewDir, vec3 lightDir, vec3 lightDirNorm) {
    return max(dot(worldNormal, -lightDirNorm), 0.0);
}
`;
