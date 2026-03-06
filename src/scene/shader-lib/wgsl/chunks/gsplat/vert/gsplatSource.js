export default /* wgsl */`
attribute vertex_position: vec3f;         // xy: cornerUV, z: render order offset
attribute vertex_id_attrib: u32;          // render order base

#ifdef GSPLAT_INDIRECT_DRAW
    // When using indirect draw with compaction, numSplats is written by the
    // write-indirect-args compute shader and read from a storage buffer.
    var<storage, read> numSplatsStorage: array<u32>;
    // Sorted visible splat IDs
    var<storage, read> compactedSplatIds: array<u32>;
#else
    uniform numSplats: u32;               // total number of splats

    var<storage, read> splatOrder: array<u32>;
#endif

// initialize the splat source structure
fn initSource(source: ptr<function, SplatSource>) -> bool {
    // calculate splat order
    source.order = vertex_id_attrib + u32(vertex_position.z);

    // return if out of range (since the last block of splats may be partially full)
    #ifdef GSPLAT_INDIRECT_DRAW
        let numSplats = numSplatsStorage[0];
    #else
        let numSplats = uniform.numSplats;
    #endif
    if (source.order >= numSplats) {
        return false;
    }

    // read splat id and initialize global splat for format read functions
    var splatId: u32;
    #ifdef GSPLAT_INDIRECT_DRAW
        splatId = compactedSplatIds[source.order];
    #else
        splatId = splatOrder[source.order];
    #endif
    setSplat(splatId);

    // get the corner
    source.cornerUV = half2(vertex_position.xy);

    return true;
}
`;
