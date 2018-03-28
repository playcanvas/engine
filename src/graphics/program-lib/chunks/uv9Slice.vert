#ifndef NINESLICE
#define NINESLICE
uniform vec4 innerOffset;
uniform vec2 outerScale;
uniform vec4 atlasRect;
varying vec2 vTiledUv;
#endif

varying vec2 vMask;

vec2 getUv0() {
    vec2 uv = vertex_position.xz;

    // offset inner vertices inside
    // (original vertices must be in [-1;1] range)
    vec2 positiveUnitOffset = clamp(vertex_position.xz, vec2(0.0), vec2(1.0));
    vec2 negativeUnitOffset = clamp(-vertex_position.xz, vec2(0.0), vec2(1.0));
    uv += (-positiveUnitOffset * innerOffset.xy + negativeUnitOffset * innerOffset.zw) * vertex_texCoord0.xy;

    uv = uv * -0.5 + 0.5;
    uv = uv * atlasRect.zw + atlasRect.xy;

    vMask = vertex_texCoord0.xy;

    return uv;
}
