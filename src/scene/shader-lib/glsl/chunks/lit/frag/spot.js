export default /* glsl */`
float getSpotEffect(vec3 lightSpotDir, float lightInnerConeAngle, float lightOuterConeAngle, vec3 lightDirNorm) {
    float cosAngle = dot(lightDirNorm, lightSpotDir);
    return smoothstep(lightOuterConeAngle, lightInnerConeAngle, cosAngle);
}
`;
