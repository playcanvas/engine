export default /* wgsl */`
attribute vertex_position: vec3f;         // xy: cornerUV, z: render order offset
attribute vertex_id_attrib: u32;          // render order base

#ifdef GSPLAT_INDIRECT_DRAW
    // When using indirect draw with compaction, numSplats is written by the
    // write-indirect-args compute shader and read from a storage buffer.
    var<storage, read> numSplatsStorage: array<u32>;
    // Compacted visible splat IDs for double indirection
    var<storage, read> compactedSplatIds: array<u32>;
#else
    uniform numSplats: u32;               // total number of splats
#endif

#ifdef STORAGE_ORDER
    var<storage, read> splatOrder: array<u32>;
#else
    // texture for non-unified gsplat rendering
    var splatOrder: texture_2d<u32>;
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
        #ifdef GSPLAT_COMPACTED_ORDER
            // Single indirection: compactedSplatIds already contains sorted visible IDs
            // (used when CPU sorting + GPU compaction produces pre-sorted compacted output)
            splatId = compactedSplatIds[source.order];
        #else
            // Double indirection: sortedIndices -> compactedSplatIds -> actual splat ID
            // (used when GPU sorting produces sort indices into the compacted buffer)
            let sortedIdx = splatOrder[source.order];
            splatId = compactedSplatIds[sortedIdx];
        #endif
    #else
        #ifdef STORAGE_ORDER
            splatId = splatOrder[source.order];
        #else
            let uv = vec2u(source.order % uniform.splatTextureSize, source.order / uniform.splatTextureSize);
            splatId = textureLoad(splatOrder, vec2i(uv), 0).r;
        #endif
    #endif
    setSplat(splatId);

    // get the corner
    source.cornerUV = half2(vertex_position.xy);

    return true;
}
`;
