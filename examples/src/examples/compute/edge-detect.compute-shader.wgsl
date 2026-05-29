// Include half-precision type aliases (resolves to f16 when supported, f32 otherwise)
#include "halfTypesCS"

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
    var color = half4(textureSampleLevel(inputTexture, inputTexture_sampler, uvFloat, 0.0));
    
    // Sobel edge detection using 3x3 kernel
    let texelSize = 1.0 / vec2f(texSize);
    
    // Sample 3x3 neighborhood and convert to grayscale (using half precision)
    var samples: array<half, 9>;
    var idx = 0;
    for (var y = -1; y <= 1; y++) {
        for (var x = -1; x <= 1; x++) {
            let offset = vec2f(f32(x), f32(y)) * texelSize;
            let sampleUV = uvFloat + offset;
            let sampleColor = half3(textureSampleLevel(inputTexture, inputTexture_sampler, sampleUV, 0.0).rgb);
            // Convert to grayscale using standard luminance weights
            samples[idx] = dot(sampleColor, half3(0.299, 0.587, 0.114));
            idx++;
        }
    }
    
    // Sobel horizontal and vertical kernels
    // Horizontal: [-1, 0, 1; -2, 0, 2; -1, 0, 1]
    let gx: half = -samples[0] + samples[2] - half(2.0) * samples[3] + half(2.0) * samples[5] - samples[6] + samples[8];
    
    // Vertical: [-1, -2, -1; 0, 0, 0; 1, 2, 1]
    let gy: half = -samples[0] - half(2.0) * samples[1] - samples[2] + samples[6] + half(2.0) * samples[7] + samples[8];
    
    // Calculate edge magnitude
    let edgeStrength: half = sqrt(gx * gx + gy * gy);
    
    // Make edges red: stronger edges = more red
    let edgeAmount: half = clamp(edgeStrength * half(3.0), half(0.0), half(1.0));
    let edgeColor = half3(1.0, 0.0, 0.0); // Red
    
    // Blend original color with red edges
    var finalColor: half3 = mix(color.rgb, edgeColor, edgeAmount);
    
    // Write to output storage texture (convert half back to f32 for storage)
    textureStore(outputTexture, vec2i(uv), vec4f(vec3f(finalColor), f32(color.a)));
}

