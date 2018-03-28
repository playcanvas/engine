#ifndef NINESLICE
#define NINESLICE
uniform vec4 innerOffset;
uniform vec2 outerScale;
vec2 saturate(vec2 v) {
    return clamp(v, vec2(0.0), vec2(1.0));
}
varying vec2 vTiledUv;
#endif

varying vec2 vMask;

vec2 getUv0() {
    vec2 uv = vertex_position.xz;

    // offset inner vertices inside
    // (original vertices must be in [-1;1] range)
    vec2 positiveUnitOffset = saturate(vertex_position.xz);
    vec2 negativeUnitOffset = saturate(-vertex_position.xz);
    uv += (-positiveUnitOffset * innerOffset.xy + negativeUnitOffset * innerOffset.zw) * vertex_texCoord0.xy;

    uv = uv * 0.5 + 0.5;

    vMask = vertex_texCoord0.xy;

    return uv;
}
