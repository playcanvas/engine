// Effect shader: colorizes tiles with a tint color
// Dispatched indirectly based on the number of tiles found by scan shader
// Reads from input texture, writes to output storage texture

struct Uniforms {
    numTilesX: u32,
    numTilesY: u32,
    tintColor: vec3f
};
@group(0) @binding(0) var<uniform> uniforms: Uniforms;

// List of tile indices (populated by scan shader)
@group(0) @binding(1) var<storage, read> tileList: array<u32>;

// Input texture to read from (no sampler needed, using textureLoad)
@group(0) @binding(2) var inputTexture: texture_2d<f32>;

// Output storage texture (write-only)
@group(0) @binding(3) var outputTexture: texture_storage_2d<rgba8unorm, write>;

const TILE_SIZE: u32 = {TILE_SIZE}u;

@compute @workgroup_size({TILE_SIZE}, {TILE_SIZE}, 1)
fn main(
    @builtin(workgroup_id) workgroup_id: vec3u,
    @builtin(local_invocation_id) local_id: vec3u
) {
    // Each workgroup processes one tile
    // workgroup_id.x is the index into tileList
    let listIndex = workgroup_id.x;
    
    // Get the tile index from the list
    let tileIndex = tileList[listIndex];
    
    // Convert linear tile index back to tile coordinates
    let tileX = tileIndex % uniforms.numTilesX;
    let tileY = tileIndex / uniforms.numTilesX;
    
    // Calculate pixel position within the tile
    let pixelX = tileX * TILE_SIZE + local_id.x;
    let pixelY = tileY * TILE_SIZE + local_id.y;
    
    let texSize = textureDimensions(inputTexture);
    
    // Skip if outside texture bounds
    if (pixelX >= texSize.x || pixelY >= texSize.y) {
        return;
    }
    
    // Load the input texture directly (no sampling needed)
    let color = textureLoad(inputTexture, vec2i(i32(pixelX), i32(pixelY)), 0);
    
    // Apply tint color from uniforms
    let tintedColor = mix(color.rgb, uniforms.tintColor, 0.5);
    
    // Write to output storage texture
    textureStore(outputTexture, vec2i(i32(pixelX), i32(pixelY)), vec4f(tintedColor, color.a));
}
