// SteadySplats Eq. 14 / Algorithm 2. Each invocation owns one source pixel's FIFO.
export default /* wgsl */`
uniform steadyValid: u32;
uniform steadyRowStart: u32;
uniform steadyRowCount: u32;
var steadySamples: texture_2d<u32>;
var steadyWeights: texture_storage_2d<rgba32float, write>;

struct SteadyEntry {
    id: u32,
    depth: f32,
    right: f32,
    left: f32,
    down: f32,
    up: f32
}
var<storage, read_write> steadyHistory: array<SteadyEntry>;

@compute @workgroup_size(8, 8, 1)
fn main(@builtin(global_invocation_id) globalId: vec3u) {
    let p = vec2i(globalId.xy + vec2u(0u, uniform.steadyRowStart));
    if (!steadyInside(p) || globalId.y >= uniform.steadyRowCount) {
        return;
    }
    let base = (globalId.x + globalId.y * u32(uniform.steadySize.x)) * 4u;
    let sample = textureLoad(steadySamples, p, 0);
    let id = sample.y;
    var depth = 3.402823e38;
    var alpha = 1.0;
    var neighbors = vec4f(1.0);
    if (id != 0u) {
        depth = bitcast<f32>(sample.z);
        alpha = steadyAlpha(sample.x - 1u, vec2f(p) + 0.5);
        for (var n = 0u; n < 4u; n++) {
            neighbors[n] = steadyAlpha(sample.x - 1u, vec2f(p + STEADY_NEIGHBORS[n]) + 0.5);
        }
    }
    var ratio = neighbors / max(alpha, 1e-20);
    var duplicate = false;
    for (var k = 0u; k < 4u; k++) {
        if (uniform.steadyValid == 0u) {
            steadyHistory[base + k].id = 0u;
        }
        let entry = steadyHistory[base + k];
        duplicate = duplicate || (entry.id == id && id != 0u);
        // A cached depth from an older camera cannot turn the same Gaussian into an occluder.
        if (entry.id != 0u && entry.id != id && entry.depth < depth) {
            ratio *= vec4f(entry.right, entry.left, entry.down, entry.up);
        }
    }
    textureStore(steadyWeights, p, ratio);
    if (id != 0u && !duplicate) {
        for (var k = 3u; k > 0u; k--) {
            steadyHistory[base + k] = steadyHistory[base + k - 1u];
        }
        let occlusion = (1.0 - neighbors) / max(1.0 - alpha, 1e-6);
        steadyHistory[base] = SteadyEntry(id, depth, occlusion.x, occlusion.y, occlusion.z, occlusion.w);
    }
}
`;
