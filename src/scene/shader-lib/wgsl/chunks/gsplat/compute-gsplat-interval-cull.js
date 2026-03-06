// Compute shader for interval-based culling and counting.
//
// Replaces the per-pixel flag pass for the GPU sort path. Instead of testing
// every work-buffer pixel, this shader tests one bounding sphere per interval
// against the nodeVisibilityTexture and writes the interval's splat count
// (or 0 if culled) into a count buffer.
//
// After an exclusive prefix sum over numIntervals + 1 elements:
//   - prefixSum[i] gives the output offset for interval i's splats
//   - prefixSum[numIntervals] equals the total visible splat count
//
// When CULLING_ENABLED is defined, reads the bit-packed nodeVisibilityTexture
// to determine per-interval visibility. Otherwise all intervals are visible
// (count is copied directly), making this a trivial O(numIntervals) pass that
// still produces the prefix-sum input needed by the scatter shader.

export const computeGsplatIntervalCullSource = /* wgsl */`

struct Interval {
    workBufferBase: u32,
    splatCount: u32,
    boundsIndex: u32,
    pad: u32
};

struct CullUniforms {
    numIntervals: u32,
    visWidth: u32
};
@group(0) @binding(0) var<uniform> uniforms: CullUniforms;

@group(0) @binding(1) var<storage, read> intervals: array<Interval>;

@group(0) @binding(2) var<storage, read_write> countBuffer: array<u32>;

#ifdef CULLING_ENABLED
@group(0) @binding(3) var nodeVisibilityTexture: texture_2d<u32>;
#endif

@compute @workgroup_size({WORKGROUP_SIZE})
fn main(@builtin(global_invocation_id) gid: vec3u) {
    let idx = gid.x;
    if (idx < uniforms.numIntervals) {
        let interval = intervals[idx];

        #ifdef CULLING_ENABLED
            let boundsIdx = interval.boundsIndex;
            let texelIdx = boundsIdx >> 5u;
            let bitIdx = boundsIdx & 31u;
            let visW = uniforms.visWidth;
            let visCoord = vec2i(i32(texelIdx % visW), i32(texelIdx / visW));
            let visBits = textureLoad(nodeVisibilityTexture, visCoord, 0).r;
            let visible = (visBits & (1u << bitIdx)) != 0u;
            countBuffer[idx] = select(0u, interval.splatCount, visible);
        #else
            countBuffer[idx] = interval.splatCount;
        #endif
    }

    // Thread 0 writes sentinel so prefixSum[numIntervals] = total visible count
    if (idx == 0u) {
        countBuffer[uniforms.numIntervals] = 0u;
    }
}
`;

export default computeGsplatIntervalCullSource;
