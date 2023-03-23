export default /* glsl */`
float getSpotEffect(vec3 lightSpotDirW, float lightInnerConeAngle, float lightOuterConeAngle, vec3 lightDirNorm) {
    float cosAngle = dot(lightDirNorm, lightSpotDirW);
    return smoothstep(lightOuterConeAngle, lightInnerConeAngle, cosAngle);
}
`;
