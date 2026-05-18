// Scan shader: analyzes 32x32 tiles for DEPTH DISCONTINUITIES (edges/silhouettes) and builds TWO lists:
// - edgeTileList: tiles with significant depth range (min to max difference)
// - smoothTileList: tiles with uniform depth

struct Uniforms {
    threshold: f32,           // depth range threshold to detect edges
    cameraNear: f32,          // camera near plane
    cameraFar: f32,           // camera far plane
    numTilesX: u32,           // number of tiles in X direction
    numTilesY: u32,           // number of tiles in Y direction
    edgeIndirectSlot: u32,    // slot index for edge tiles indirect dispatch
    smoothIndirectSlot: u32   // slot index for smooth tiles indirect dispatch
};
@group(0) @binding(0) var<uniform> uniforms: Uniforms;

// Depth texture to analyze (unfilterable, use textureLoad)
@group(0) @binding(1) var depthTexture: texture_depth_2d;

// Output: list of edge tile indices
@group(0) @binding(2) var<storage, read_write> edgeTileList: array<u32>;

// Output: list of smooth tile indices
@group(0) @binding(3) var<storage, read_write> smoothTileList: array<u32>;

// Counter for number of edge tiles
@group(0) @binding(4) var<storage, read_write> edgeTileCounter: atomic<u32>;

// Counter for number of smooth tiles
@group(0) @binding(5) var<storage, read_write> smoothTileCounter: atomic<u32>;

// Counter to track workgroup completion (for proper synchronization)
@group(0) @binding(6) var<storage, read_write> completionCounter: atomic<u32>;

// Indirect dispatch buffer - we write (count, 1, 1) to the allocated slots
struct DispatchIndirectArgs {
    x: u32,
    y: u32,
    z: u32
};
@group(0) @binding(7) var<storage, read_write> indirectDispatchBuffer: array<DispatchIndirectArgs>;

const TILE_SIZE: u32 = {TILE_SIZE}u;

// Linearize depth from normalized device coordinates to view space depth
fn linearizeDepth(depth: f32, near: f32, far: f32) -> f32 {
    // Reverse-Z or standard depth: convert [0,1] NDC depth to linear view-space depth
    return (near * far) / (far + depth * (near - far));
}

// Safe textureLoad with bounds checking
fn loadDepth(coord: vec2i, texSize: vec2u) -> f32 {
    let clampedCoord = clamp(coord, vec2i(0), vec2i(texSize) - vec2i(1));
    return textureLoad(depthTexture, clampedCoord, 0);
}

@compute @workgroup_size(1)
fn main(@builtin(global_invocation_id) global_id: vec3u) {
    let tileX = global_id.x;
    let tileY = global_id.y;
    
    // Skip if outside tile grid
    if (tileX >= uniforms.numTilesX || tileY >= uniforms.numTilesY) {
        return;
    }
    
    let texSize = textureDimensions(depthTexture);
    
    // Calculate tile bounds in pixels
    let startX = tileX * TILE_SIZE;
    let startY = tileY * TILE_SIZE;
    let endX = min(startX + TILE_SIZE, texSize.x);
    let endY = min(startY + TILE_SIZE, texSize.y);
    
    // Track min and max linearized depth in the tile
    var minDepth: f32 = 1e10;
    var maxDepth: f32 = 0.0;
    
    // Sample every 4th pixel for efficiency (8x8 samples per tile)
    for (var y = startY; y < endY; y += 4u) {
        for (var x = startX; x < endX; x += 4u) {
            let coord = vec2i(i32(x), i32(y));
            
            // Load and linearize depth
            let rawDepth = loadDepth(coord, texSize);
            let linearDepth = linearizeDepth(rawDepth, uniforms.cameraNear, uniforms.cameraFar);
            
            // Track min/max
            minDepth = min(minDepth, linearDepth);
            maxDepth = max(maxDepth, linearDepth);
        }
    }
    
    // Calculate depth range in the tile (in world units)
    let depthRange = maxDepth - minDepth;
    
    // Classify tile based on whether depth range exceeds threshold
    if (depthRange > uniforms.threshold) {
        // Significant depth variation - add to edge list
        let listIndex = atomicAdd(&edgeTileCounter, 1u);
        edgeTileList[listIndex] = tileY * uniforms.numTilesX + tileX;
    } else {
        // Uniform depth - add to smooth list
        let listIndex = atomicAdd(&smoothTileCounter, 1u);
        smoothTileList[listIndex] = tileY * uniforms.numTilesX + tileX;
    }
    
    // Increment completion counter - the tile that reaches totalTiles writes the dispatch args
    let totalTiles = uniforms.numTilesX * uniforms.numTilesY;
    let completed = atomicAdd(&completionCounter, 1u) + 1u;
    
    if (completed == totalTiles) {
        // This is truly the last tile to complete - safe to read final counts
        let edgeCount = atomicLoad(&edgeTileCounter);
        indirectDispatchBuffer[uniforms.edgeIndirectSlot].x = edgeCount;
        indirectDispatchBuffer[uniforms.edgeIndirectSlot].y = 1u;
        indirectDispatchBuffer[uniforms.edgeIndirectSlot].z = 1u;
        
        let smoothCount = atomicLoad(&smoothTileCounter);
        indirectDispatchBuffer[uniforms.smoothIndirectSlot].x = smoothCount;
        indirectDispatchBuffer[uniforms.smoothIndirectSlot].y = 1u;
        indirectDispatchBuffer[uniforms.smoothIndirectSlot].z = 1u;
    }
}
