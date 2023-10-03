export default /* glsl */`
void getTBN(vec3 tangent, vec3 binormal, vec3 normal) {
    dTBN = mat3(tangent, binormal, normal);
}
`;
