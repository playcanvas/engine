// Gather the source pixel's outward PDF ratios, including background coverage (Eq. 9).
export default /* wgsl */`
uniform steadySize: vec2f;
var steadyRaw: texture_2d<f32>;
var steadyWeights: texture_2d<uff>;
var steadySpatial: texture_storage_2d<rgba16float, write>;

const STEADY_NEIGHBORS = array<vec2i, 4>(vec2i(1, 0), vec2i(-1, 0), vec2i(0, 1), vec2i(0, -1));

@compute @workgroup_size(8, 8, 1)
fn main(@builtin(global_invocation_id) globalId: vec3u) {
    let p = vec2i(globalId.xy);
    let size = vec2i(uniform.steadySize);
    if (any(p >= size)) {
        return;
    }
    var color = textureLoad(steadyRaw, p, 0);
    var mass = 1.0;
    for (var n = 0u; n < 4u; n++) {
        let source = p - STEADY_NEIGHBORS[n];
        if (all(source >= vec2i(0)) && all(source < size)) {
            let weight = textureLoad(steadyWeights, source, 0)[n];
            color += textureLoad(steadyRaw, source, 0) * weight;
            mass += weight;
        }
    }
    textureStore(steadySpatial, p, color / mass);
}
`;
