export default /* wgsl */`
attribute vertex_position: vec3f;         // xy: cornerUV, z: render order offset
attribute vertex_id_attrib: u32;          // render order base

uniform numSplats: u32;                   // total number of splats
uniform splatTextureSize: u32;            // texture size for splat data

#ifdef STORAGE_ORDER
    var<storage, read> splatOrder: array<u32>;
#else
    // support texture for non-unified gsplat rendering
    var splatOrder: texture_2d<u32>;
#endif

// initialize the splat source structure
fn initSource(source: ptr<function, SplatSource>) -> bool {
    // calculate splat order
    source.order = vertex_id_attrib + u32(vertex_position.z);

    // return if out of range (since the last block of splats may be partially full)
    if (source.order >= uniform.numSplats) {
        return false;
    }

    // read splat id
    #ifdef STORAGE_ORDER
        source.id = splatOrder[source.order];
    #else
        let uv = vec2u(source.order % uniform.splatTextureSize, source.order / uniform.splatTextureSize);
        source.id = textureLoad(splatOrder, vec2i(uv), 0).r;
    #endif

    // map id to uv
    source.uv = vec2i(vec2u(source.id % uniform.splatTextureSize, source.id / uniform.splatTextureSize));

    // get the corner
    source.cornerUV = vertex_position.xy;

    return true;
}
`;
