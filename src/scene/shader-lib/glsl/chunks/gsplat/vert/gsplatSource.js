export default /* glsl */`
attribute vec3 vertex_position;         // xy: cornerUV, z: render order offset
attribute uint vertex_id_attrib;        // render order base

uniform uint numSplats;                 // total number of splats
uniform highp usampler2D splatOrder;    // per-splat index to source gaussian

// initialize the splat source structure and global splat
bool initSource(out SplatSource source) {
    // calculate splat order
    source.order = vertex_id_attrib + uint(vertex_position.z);

    // return if out of range (since the last block of splats may be partially full)
    if (source.order >= numSplats) {
        return false;
    }

    ivec2 orderUV = ivec2(source.order % splatTextureSize, source.order / splatTextureSize);

    // read splat id and initialize global splat for format read functions
    uint splatId = texelFetch(splatOrder, orderUV, 0).r;
    setSplat(splatId);

    // get the corner
    source.cornerUV = vertex_position.xy;

    return true;
}
`;
