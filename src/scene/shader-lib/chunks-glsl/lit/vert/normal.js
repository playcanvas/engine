export default /* glsl */`
mat3 dNormalMatrix;

vec3 getNormal() {
    dNormalMatrix = getNormalMatrix(dModelMatrix);
    vec3 localNormal = getLocalNormal(vertex_normal);
    return normalize(dNormalMatrix * localNormal);
}
`;
