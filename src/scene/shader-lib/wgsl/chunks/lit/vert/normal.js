export default /* wgsl */`
var<private> dNormalMatrix: mat3x3f;

fn getNormal() -> vec3f {
    dNormalMatrix = getNormalMatrix(dModelMatrix);
    let localNormal: vec3f = getLocalNormal(vertex_normal);
    return normalize(dNormalMatrix * localNormal);
}`;
