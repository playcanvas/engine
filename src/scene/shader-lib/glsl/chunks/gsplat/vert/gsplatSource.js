export default /* glsl */`
attribute vec3 vertex_position;         // xy: cornerUV, z: render order offset
attribute uint vertex_id_attrib;        // render order base

uniform uint numSplats;                 // total number of splats
uniform highp usampler2D splatOrder;    // per-splat index to source gaussian

// initialize the splat source structure
bool initSource(out SplatSource source) {
    uint w = uint(textureSize(splatOrder, 0).x);
    uint idx = vertex_id_attrib + uint(vertex_position.z);
    if (idx >= numSplats) {
        return false;   // out of range
    }

    source.order = idx;
    source.id = idx;
    source.uv = ivec2(source.id % w, source.id / w);
    source.cornerUV = vertex_position.xy;

    return true;
}
`;
