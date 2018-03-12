
vec2 getUv0() {
    vec2 uv = vec2(vertex_texCoord0);
    if (vertex_texCoord1.x > 0.0) {
        uv.x = (uv.x + nineSliceUvs.z) * nineSliceUvs.x * vertex_texCoord1.x;
    }
    if (vertex_texCoord1.y > 0.0) {
        uv.y = (uv.y + nineSliceUvs.w) * nineSliceUvs.y * vertex_texCoord1.y;
    }
    return uv;
}
