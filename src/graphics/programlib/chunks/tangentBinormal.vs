
vec3 getTangent(inout vsInternalData data) {
    return normalize(data.normalMatrix * vertex_tangent.xyz);
}

vec3 getBinormal(inout vsInternalData data) {
    return cross(vNormalW, vTangentW) * vertex_tangent.w;
}

