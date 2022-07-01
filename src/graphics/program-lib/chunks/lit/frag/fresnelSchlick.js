export default /* glsl */`
// Schlick's approximation
vec3 getFresnel(float cosTheta, vec3 f0) {
    float fresnel = pow(1.0 - abs(cosTheta), 4.0);
    float glossSq = dGlossiness * dGlossiness;
    return f0 + (1.0 - f0) * fresnel * glossSq;
}

vec3 getFresnel(float cosTheta, vec3 f0, float specularityFactor) {
    float fresnel = pow(1.0 - abs(cosTheta), 5.0);
    float glossSq = dGlossiness * dGlossiness;
    return f0 + (1.0 - f0) * fresnel * glossSq * specularityFactor;
}
`;
