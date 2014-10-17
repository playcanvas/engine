vec3 getNormal(inout vsInternalData data) {
    data.normalMatrix = mat3(data.modelMatrix[0].xyz, data.modelMatrix[1].xyz, data.modelMatrix[2].xyz);
    return normalize(data.normalMatrix * vertex_normal);
}

