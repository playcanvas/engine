@group(0) @binding(0) var inputTexture: texture_2d<f32>;
@group(0) @binding(1) var inputTexture_sampler: sampler;
@group(0) @binding(2) var outputTexture: texture_storage_2d<rgba8unorm, write>;

@compute @workgroup_size(8, 8, 1)
fn main(@builtin(global_invocation_id) global_id : vec3u) {
    let uv = vec2u(global_id.xy);
    let texSize = textureDimensions(inputTexture);
    
    // Skip if outside texture bounds
    if (uv.x >= texSize.x || uv.y >= texSize.y) {
        return;
    }
    
    // Sample the input texture (resolved from MSAA)
    let uvFloat = (vec2f(uv) + vec2f(0.5)) / vec2f(texSize);
    var color = textureSampleLevel(inputTexture, inputTexture_sampler, uvFloat, 0.0);
    
    // Swap red and blue channels to visually confirm compute shader ran
    let swapped = vec4f(color.b, color.g, color.r, color.a);
    
    // Write to output storage texture
    textureStore(outputTexture, vec2i(uv), swapped);
}

