// Compute shader for generating GSplat sort keys from world-space positions in work buffer
// Uses camera-relative bin weighting for precision optimization near the camera
// Supports both linear (forward vector) and radial (distance) sorting modes

export const computeGsplatSortKeySource = /* wgsl */`

// Work buffer texture containing world-space centers (RGBA32U: xyz as floatBitsToUint)
@group(0) @binding(0) var dataTransformA: texture_2d<u32>;

// Output sort keys (one u32 per splat)
@group(0) @binding(1) var<storage, read_write> sortKeys: array<u32>;

// Uniforms
struct SortKeyUniforms {
    cameraPosition: vec3f,
    elementCount: u32,
    cameraDirection: vec3f,
    numBits: u32,
    textureSize: u32,
    minDist: f32,
    invRange: f32,
    numWorkgroupsX: u32,
    numBins: u32
};
@group(0) @binding(2) var<uniform> uniforms: SortKeyUniforms;

// Camera-relative bin weighting (entries with base and divider)
struct BinWeight {
    base: f32,
    divider: f32
};
@group(0) @binding(3) var<storage, read> binWeights: array<BinWeight>;

#ifdef USE_INDIRECT_SORT
    // Compacted visible splat IDs from stream compaction
    @group(0) @binding(4) var<storage, read> compactedSplatIds: array<u32>;

    // sortElementCount from write-indirect-args (same buffer the radix sort reads)
    @group(0) @binding(5) var<storage, read> sortElementCountBuf: array<u32>;
#endif

@compute @workgroup_size({WORKGROUP_SIZE_X}, {WORKGROUP_SIZE_Y}, 1)
fn main(
    @builtin(global_invocation_id) global_id: vec3u,
    @builtin(workgroup_id) w_id: vec3u,
    @builtin(num_workgroups) w_dim: vec3u,
    @builtin(local_invocation_index) TID: u32
) {
    // Compute flat GID: for indirect dispatch use workgroup/local builtins (dispatch
    // dimensions are GPU-written so uniforms.numWorkgroupsX won't match). For direct
    // dispatch the 2D global_invocation_id linearization is used.
    #ifdef USE_INDIRECT_SORT
        let WORKGROUP_ID = w_id.x + w_id.y * w_dim.x;
        let gid = WORKGROUP_ID * ({WORKGROUP_SIZE_X}u * {WORKGROUP_SIZE_Y}u) + TID;
    #else
        let gid = global_id.x + global_id.y * ({WORKGROUP_SIZE_X} * uniforms.numWorkgroupsX);
    #endif
    
    // Early exit for out-of-bounds threads
    if (gid >= uniforms.elementCount) {
        return;
    }

    #ifdef USE_INDIRECT_SORT
        // With indirect dispatch, only visibleCount threads are launched (plus up to
        // 255 padding threads from workgroup rounding). Early-out for padding threads.
        let visibleCount = sortElementCountBuf[0];
        if (gid >= visibleCount) {
            return;
        }

        // Read actual splat ID from compacted buffer
        let splatId = compactedSplatIds[gid];
    #else
        let splatId = gid;
    #endif
    
    // Calculate texture UV from splat ID
    let textureSize = uniforms.textureSize;
    let uv = vec2i(i32(splatId % textureSize), i32(splatId / textureSize));
    
    // Load world-space center from work buffer (stored as floatBitsToUint)
    let packed = textureLoad(dataTransformA, uv, 0);
    let worldCenter = vec3f(
        bitcast<f32>(packed.r),
        bitcast<f32>(packed.g),
        bitcast<f32>(packed.b)
    );
    
    // Calculate distance based on sort mode
    var dist: f32;
    
    #ifdef RADIAL_SORT
        // Radial mode: distance from camera (inverted so far objects get small keys)
        let delta = worldCenter - uniforms.cameraPosition;
        let radialDist = length(delta);
        // Invert distance so far objects get small keys (rendered first, back-to-front)
        dist = (1.0 / uniforms.invRange) - radialDist - uniforms.minDist;
    #else
        // Linear mode: distance along camera forward vector
        let toSplat = worldCenter - uniforms.cameraPosition;
        dist = dot(toSplat, uniforms.cameraDirection) - uniforms.minDist;
    #endif
    
    // Apply bin-based mapping for camera-relative precision weighting
    let numBins = uniforms.numBins;
    let d = dist * uniforms.invRange * f32(numBins);
    let binFloat = clamp(d, 0.0, f32(numBins) - 0.001);
    let bin = u32(binFloat);
    let binFrac = binFloat - f32(bin);
    
    // Calculate final sort key using pre-computed bin weighting
    let sortKey = u32(binWeights[bin].base + binWeights[bin].divider * binFrac);
    
    // Write sort key
    sortKeys[gid] = sortKey;
}
`;

export default computeGsplatSortKeySource;
