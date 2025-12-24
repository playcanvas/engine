export default /* glsl */`

vec3 getSpecularModulate(in vec3 specularity, in vec3 albedo, in float metalness, in float f0, in float specularityFactor) {
    // Apply specularityFactor to dielectric F0 only. For metals (metalness=1), F0 is the albedo
    // and should not be affected by specularityFactor per the KHR_materials_specular glTF spec.
    vec3 dielectricF0 = f0 * specularity * specularityFactor;
    return mix(dielectricF0, albedo, metalness);
}

vec3 getAlbedoModulate(in vec3 albedo, in float metalness) {
    return albedo * (1.0 - metalness);
}
`;
