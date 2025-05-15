export default /* wgsl */`
attribute vertex_position: vec3f;         // xy: cornerUV, z: render order offset
attribute vertex_id_attrib: u32;          // render order base

uniform numSplats: u32;                   // total number of splats
var splatOrder: texture_2d<u32>;          // per-splat index to source gaussian

// initialize the splat source structure
fn initSource(source: ptr<function, SplatSource>) -> bool {
    let w: u32 = textureDimensions(splatOrder, 0).x;

    // calculate splat order
    source.order = vertex_id_attrib + u32(vertex_position.z);

    // return if out of range (since the last block of splats may be partially full)
    if (source.order >= uniform.numSplats) {
        return false;
    }

    let orderUV = vec2i(vec2u(source.order % w, source.order / w));

    // read splat id
    source.id = textureLoad(splatOrder, orderUV, 0).r;

    // map id to uv
    source.uv = vec2i(vec2u(source.id % w, source.id / w));

    // get the corner
    source.cornerUV = vertex_position.xy;

    return true;
}
`;
