export default /* glsl */`
// Schlick's approximation
vec3 getFresnel(float cosTheta, vec3 f0) {
    float fresnel = pow(1.0 - max(cosTheta, 0.0), 5.0);
    float glossSq = dGlossiness * dGlossiness;
    return f0 + (max(vec3(glossSq), f0) - f0) * fresnel;
}
`;
