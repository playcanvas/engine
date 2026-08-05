// Compute shader for interval-based scatter (stream compaction).
//
// Dispatched with one workgroup per interval, each containing WORKGROUP_SIZE threads.
// The dispatch is tiled across X and Y (the interval count can exceed the per-dimension
// workgroup limit), so the linear interval index is reconstructed from the 2D workgroup id.
// Each workgroup handles one interval: it reads the prefix-sum output to determine
// the output offset and visible count, then writes contiguous work-buffer pixel
// indices into the compacted output array.
//
// Invisible intervals (where the prefix sum does not increment) cause the entire
// workgroup to return immediately. Visible intervals write their splat IDs in a
// tight parallel loop with zero divergence within the workgroup.

export const computeGsplatIntervalScatterSource = /* wgsl */`

struct Interval {
    workBufferBase: u32,
    splatCount: u32,
    boundsIndex: u32,
    pad: u32
};

struct ScatterUniforms {
    numIntervals: u32,
    pad0: u32,
    pad1: u32,
    pad2: u32
};
@group(0) @binding(0) var<uniform> uniforms: ScatterUniforms;

@group(0) @binding(1) var<storage, read> intervals: array<Interval>;

@group(0) @binding(2) var<storage, read> prefixSumBuffer: array<u32>;

@group(0) @binding(3) var<storage, read_write> compactedOutput: array<u32>;

@compute @workgroup_size({WORKGROUP_SIZE})
fn main(
    @builtin(workgroup_id) wgId: vec3u,
    @builtin(num_workgroups) numWorkgroups: vec3u,
    @builtin(local_invocation_id) lid: vec3u
) {
    // reconstruct the linear interval index from the (possibly Y-tiled) 2D dispatch
    let intervalIdx = wgId.y * numWorkgroups.x + wgId.x;
    if (intervalIdx >= uniforms.numIntervals) { return; }

    let outputOffset = prefixSumBuffer[intervalIdx];
    let nextOffset = prefixSumBuffer[intervalIdx + 1u];
    let count = nextOffset - outputOffset;
    if (count == 0u) { return; }

    let workBufferBase = intervals[intervalIdx].workBufferBase;
    let tid = lid.x;

    for (var j = tid; j < count; j += {WORKGROUP_SIZE}u) {
        compactedOutput[outputOffset + j] = workBufferBase + j;
    }
}
`;

export default computeGsplatIntervalScatterSource;
