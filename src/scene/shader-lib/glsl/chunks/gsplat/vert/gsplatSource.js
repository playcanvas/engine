export default /* glsl */`
attribute vec3 vertex_position;         // unused on WebGL (corners from gl_VertexID)
attribute uint vertex_id_attrib;        // sorted splatId (per-instance)

uniform uint numSplats;                 // total number of splats

// initialize the splat source structure and global splat
bool initSource(out SplatSource source) {
    // splatId comes directly from the instance vertex buffer
    uint splatId = vertex_id_attrib;

    source.order = uint(gl_InstanceID);

    setSplat(splatId);

    // derive quad corner from gl_VertexID (index buffer: 0,1,2, 0,2,3)
    source.cornerUV = vec2(
        (gl_VertexID == 1 || gl_VertexID == 2) ? 1.0 : -1.0,
        (gl_VertexID >= 2) ? 1.0 : -1.0
    );

    return true;
}
`;
