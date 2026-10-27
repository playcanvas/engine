// SteadySplats Eq. 14 / Algorithm 2. Each invocation owns one source pixel's FIFO.
export default /* wgsl */`
uniform steadyValid: u32;
uniform steadyRowStart: u32;
uniform steadyRowCount: u32;
var steadySamples: texture_2d<u32>;
var steadyWeights: texture_storage_2d<rgba32float, write>;
var<storage, read> steadyIds: array<u32>;

struct SteadyEntry {
    id: u32,
    depth: f32,
    horizontal: u32,
    vertical: u32
}
struct SteadyPixel {
    entries: array<SteadyEntry, 4>,
    state: u32
}
var<storage, read_write> steadyHistory: array<SteadyPixel>;

@compute @workgroup_size(8, 8, 1)
fn main(@builtin(global_invocation_id) globalId: vec3u) {
    let p = vec2i(globalId.xy + vec2u(0u, uniform.steadyRowStart));
    if (!steadyInside(p) || globalId.y >= uniform.steadyRowCount) {
        return;
    }
    let base = globalId.x + globalId.y * u32(uniform.steadySize.x);
    var state = 0u;
    if (uniform.steadyValid != 0u) {
        state = steadyHistory[base].state;
    }
    let head = state & 3u;
    let count = state >> 2u;
    let sample = textureLoad(steadySamples, p, 0);
    var id = 0u;
    var depth = 3.402823e38;
    var alpha = 1.0;
    var neighbors = vec4f(1.0);
    if (sample.x != 0u) {
        id = steadyIds[sample.x - 1u] + 1u;
        depth = bitcast<f32>(sample.y);
        let gaussian = steadyGaussian(sample.x - 1u);
        alpha = steadyAlpha(gaussian, vec2f(p) + 0.5);
        for (var n = 0u; n < 4u; n++) {
            neighbors[n] = steadyAlpha(gaussian, vec2f(p + STEADY_NEIGHBORS[n]) + 0.5);
        }
    }
    var ratio = neighbors / max(alpha, 1e-20);
    var duplicate = false;
    // Traverse newest to oldest, preserving the PDF multiplication order without shifting
    // three full entries on insertion. A zero count also avoids reading empty pixel histories.
    for (var k = 0u; k < count; k++) {
        let entry = steadyHistory[base].entries[(head + k) & 3u];
        duplicate = duplicate || (entry.id == id && id != 0u);
        // A cached depth from an older camera cannot turn the same Gaussian into an occluder.
        if (entry.id != 0u && entry.id != id && entry.depth < depth) {
            ratio *= vec4f(unpack2x16float(entry.horizontal), unpack2x16float(entry.vertical));
        }
    }
    textureStore(steadyWeights, p, ratio);
    // Empty draws must not evict rare foreground samples from this distinct-occluder FIFO.
    if (id != 0u && !duplicate) {
        let next = (head + 3u) & 3u;
        let occlusion = (1.0 - neighbors) / max(1.0 - alpha, 1e-6);
        // Alpha is capped at 0.999, bounding each cached ratio well inside the half-float range.
        // Keep identities, depth and all ratio arithmetic at full precision, as on WebGL2.
        steadyHistory[base].entries[next] = SteadyEntry(id, depth, pack2x16float(occlusion.xy), pack2x16float(occlusion.zw));
        steadyHistory[base].state = next | (min(count + 1u, 4u) << 2u);
    } else if (uniform.steadyValid == 0u) {
        steadyHistory[base].state = 0u;
    }
}
`;
