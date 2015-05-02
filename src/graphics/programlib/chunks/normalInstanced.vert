vec3 getNormal(inout vsInternalData data) {
    data.normalMatrix = mat3(instance_line1.xyz, instance_line2.xyz, instance_line3.xyz);
    return normalize(data.normalMatrix * vertex_normal);
}

