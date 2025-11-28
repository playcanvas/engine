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
    
    // Sample the center pixel
    let uvFloat = (vec2f(uv) + vec2f(0.5)) / vec2f(texSize);
    var color = textureSampleLevel(inputTexture, inputTexture_sampler, uvFloat, 0.0);
    
    // Sobel edge detection using 3x3 kernel
    let texelSize = 1.0 / vec2f(texSize);
    
    // Sample 3x3 neighborhood and convert to grayscale
    var samples: array<f32, 9>;
    var idx = 0;
    for (var y = -1; y <= 1; y++) {
        for (var x = -1; x <= 1; x++) {
            let offset = vec2f(f32(x), f32(y)) * texelSize;
            let sampleUV = uvFloat + offset;
            let sampleColor = textureSampleLevel(inputTexture, inputTexture_sampler, sampleUV, 0.0);
            // Convert to grayscale using standard luminance weights
            samples[idx] = dot(sampleColor.rgb, vec3f(0.299, 0.587, 0.114));
            idx++;
        }
    }
    
    // Sobel horizontal and vertical kernels
    // Horizontal: [-1, 0, 1; -2, 0, 2; -1, 0, 1]
    let gx = -samples[0] + samples[2] - 2.0 * samples[3] + 2.0 * samples[5] - samples[6] + samples[8];
    
    // Vertical: [-1, -2, -1; 0, 0, 0; 1, 2, 1]
    let gy = -samples[0] - 2.0 * samples[1] - samples[2] + samples[6] + 2.0 * samples[7] + samples[8];
    
    // Calculate edge magnitude
    let edgeStrength = sqrt(gx * gx + gy * gy);
    
    // Make edges red: stronger edges = more red
    let edgeAmount = clamp(edgeStrength * 3.0, 0.0, 1.0);
    let edgeColor = vec3f(1.0, 0.0, 0.0); // Red
    
    // Blend original color with red edges
    var finalColor = mix(color.rgb, edgeColor, edgeAmount);
    
    // Write to output storage texture (no channel swap - keep edges red)
    textureStore(outputTexture, vec2i(uv), vec4f(finalColor, color.a));
}

