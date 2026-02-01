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

@compute @workgroup_size({WORKGROUP_SIZE_X}, {WORKGROUP_SIZE_Y}, 1)
fn computeSortKey(@builtin(global_invocation_id) global_id: vec3u) {
    let gid = global_id.x + global_id.y * ({WORKGROUP_SIZE_X} * uniforms.numWorkgroupsX);
    
    // Early exit for out-of-bounds threads
    if (gid >= uniforms.elementCount) {
        return;
    }
    
    // Calculate texture UV from linear index
    let textureSize = uniforms.textureSize;
    let uv = vec2i(i32(gid % textureSize), i32(gid / textureSize));
    
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
