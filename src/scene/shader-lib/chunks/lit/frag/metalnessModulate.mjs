export default /* glsl */`

vec3 getSpecularModulate(in vec3 specularity, in vec3 albedo, in float metalness, in float f0) {
    vec3 dielectricF0 = f0 * specularity;
    return mix(dielectricF0, albedo, metalness);
}

vec3 getAlbedoModulate(in vec3 albedo, in float metalness) {
    return albedo * (1.0 - metalness);
}
`;
