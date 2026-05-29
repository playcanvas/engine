var sortedIndices: texture_2d<u32>;
var keysTexture: texture_2d<u32>;

uniform elementCount: f32;
uniform textureWidth: f32;
uniform maxValue: f32;
uniform sourceTextureSize: vec2f;
uniform debugMode: f32;

varying vUv0: vec2f;

@fragment
fn fragmentMain(input: FragmentInput) -> FragmentOutput {
    var output: FragmentOutput;
    let uv = input.vUv0;

    // Debug mode: show UVs as colors
    if (uniform.debugMode > 0.5) {
        output.color = vec4f(uv.x, uv.y, 0.5, 1.0);
        return output;
    }

    let pixelX = i32(uv.x * uniform.textureWidth);
    let pixelY = i32(uv.y * uniform.textureWidth);
    let linearIdx = u32(pixelY) * u32(uniform.textureWidth) + u32(pixelX);

    if (f32(linearIdx) >= uniform.elementCount) {
        output.color = vec4f(0.2, 0.2, 0.2, 1.0);
        return output;
    }

    // Get the original index at this sorted position (linear layout)
    let tw = u32(uniform.textureWidth);
    let origIdx = textureLoad(sortedIndices, vec2i(i32(linearIdx % tw), i32(linearIdx / tw)), 0).r;

    // Convert original index to source texture coordinates
    let srcX = i32(origIdx) % i32(uniform.sourceTextureSize.x);
    let srcY = i32(origIdx) / i32(uniform.sourceTextureSize.x);

    // Look up the key value from the source texture
    let value = f32(textureLoad(keysTexture, vec2i(srcX, srcY), 0).r);
    let normalized = value / uniform.maxValue;

    // Use same color scheme as unsorted view: blue (low) to red (high)
    let color = mix(vec3f(0.1, 0.2, 0.8), vec3f(0.9, 0.3, 0.1), normalized);
    output.color = vec4f(color, 1.0);
    return output;
}

