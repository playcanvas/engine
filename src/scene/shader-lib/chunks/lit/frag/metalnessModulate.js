export default /* glsl */`

uniform float material_f0;

vec3 getSpecularModulate(in vec3 specularity, in vec3 albedo, in float metalness) {
    vec3 dielectricF0 = material_f0 * specularity;
    return mix(dielectricF0, albedo, metalness);
}

vec3 getAlbedoModulate(in vec3 albedo, in float metalness) {
    return albedo * (1.0 - metalness);
}
`;
