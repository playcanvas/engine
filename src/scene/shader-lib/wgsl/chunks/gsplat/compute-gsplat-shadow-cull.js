// Directional-shadow cull + compaction for the GPU-sort (hybrid) gsplat path.
//
// Dispatched with one workgroup per interval (tiled across X/Y when the interval count exceeds the
// per-dimension workgroup limit). Each workgroup processes one interval's splats and appends the
// visible ones to a single output index buffer, reserving space with a workgroup-aggregated atomic
// (one atomicAdd per workgroup, not one per visible splat — mobile-friendly, no subgroups).
//
// Cull stage: coarse per-interval reject — the octree node's world-space bounding sphere is tested
// against the light's 6 frustum planes (same math as compute-gsplat-interval-cull.js); rejected
// intervals are skipped entirely by the whole workgroup. Surviving intervals expand all their
// splats. (The per-splat fine tests — opacity/projected-size/offscreen — are intentionally not done
// here: they need projector-grade per-splat projection + work-buffer-format coupling, and shadow
// correctness is already enforced by the shadow VS/FS alphaClip + clip. They can be layered in later
// as a per-thread visible flag + workgroup prefix-sum before the atomic reservation.)
//
// The output order is unspecified (it depends on the inter-workgroup atomic race), which is fine for
// shadows: only depth is written, so draw order does not matter.

export const computeGsplatShadowCullSource = /* wgsl */`

struct Interval {
    workBufferBase: u32,
    splatCount: u32,
    boundsIndex: u32,
    pad: u32
};

struct BoundsEntry {
    centerX: f32,
    centerY: f32,
    centerZ: f32,
    radius: f32,
    transformIndex: u32,
    pad0: u32,
    pad1: u32,
    pad2: u32
};

struct CullUniforms {
    frustumPlanes: array<vec4f, 6>,
    numIntervals: u32
};
@group(0) @binding(0) var<uniform> uniforms: CullUniforms;

@group(0) @binding(1) var<storage, read> intervals: array<Interval>;

// Output: dense list of visible work-buffer splat indices (unordered).
@group(0) @binding(2) var<storage, read_write> outputIndices: array<u32>;

// Single global atomic visible counter. Must be cleared to 0 before each dispatch.
@group(0) @binding(3) var<storage, read_write> globalCount: array<atomic<u32>>;

// Per-node bounding spheres + their transforms (camera-independent; shared with the forward cull).
@group(0) @binding(4) var<storage, read> boundsBuffer: array<BoundsEntry>;
@group(0) @binding(5) var<storage, read> transformsBuffer: array<vec4f>;

// Base output offset reserved by this workgroup, broadcast from thread 0 to the rest.
var<workgroup> wgBase: u32;

@compute @workgroup_size({WORKGROUP_SIZE})
fn main(
    @builtin(workgroup_id) wgId: vec3u,
    @builtin(num_workgroups) numWorkgroups: vec3u,
    @builtin(local_invocation_id) lid: vec3u
) {
    // reconstruct the linear interval index from the (possibly Y-tiled) 2D dispatch
    let intervalIdx = wgId.y * numWorkgroups.x + wgId.x;
    if (intervalIdx >= uniforms.numIntervals) { return; }

    let interval = intervals[intervalIdx];
    let count = interval.splatCount;
    if (count == 0u) { return; }

    // Coarse cull: transform the node's bounding sphere to world space and test it against the
    // light's frustum planes. The result is uniform across the workgroup (same interval), so the
    // early-out keeps control flow uniform for the workgroupBarrier below.
    let entry = boundsBuffer[interval.boundsIndex];
    let localCenter = vec3f(entry.centerX, entry.centerY, entry.centerZ);
    let base3 = entry.transformIndex * 3u;
    let row0 = transformsBuffer[base3];
    let row1 = transformsBuffer[base3 + 1u];
    let row2 = transformsBuffer[base3 + 2u];
    let worldCenter = vec3f(
        dot(vec4f(localCenter, 1.0), row0),
        dot(vec4f(localCenter, 1.0), row1),
        dot(vec4f(localCenter, 1.0), row2)
    );
    let worldRadius = entry.radius * length(vec3f(row0.x, row1.x, row2.x));

    for (var p = 0; p < 6; p++) {
        let plane = uniforms.frustumPlanes[p];
        if (dot(plane.xyz, worldCenter) + plane.w <= -worldRadius) {
            return; // node fully outside this plane -> whole interval culled
        }
    }

    // Reserve a contiguous block for this (visible) interval's splats with a single atomic add.
    if (lid.x == 0u) {
        wgBase = atomicAdd(&globalCount[0], count);
    }
    workgroupBarrier();
    let base = wgBase;

    let workBufferBase = interval.workBufferBase;
    for (var j = lid.x; j < count; j += {WORKGROUP_SIZE}u) {
        outputIndices[base + j] = workBufferBase + j;
    }
}
`;

export default computeGsplatShadowCullSource;
