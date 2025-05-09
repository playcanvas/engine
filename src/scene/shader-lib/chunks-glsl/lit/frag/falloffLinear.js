export default /* glsl */`
float getFalloffLinear(float lightRadius, vec3 lightDir) {
    float d = length(lightDir);
    return max(((lightRadius - d) / lightRadius), 0.0);
}
`;
