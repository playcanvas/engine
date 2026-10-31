// Visualization shader for keys (optionally using sorted indices from StorageBuffers)

varying vUv0: vec2f;

var<storage, read> keysBuffer: array<u32>;
#ifdef SORTED
var<storage, read> sortedIndices: array<u32>;
#endif

uniform maxValue: f32;
uniform elementCount: f32;
uniform textureSize: vec2f;

@fragment
fn fragmentMain(input: FragmentInput) -> FragmentOutput {
    var output: FragmentOutput;
    let uv = input.vUv0;

    let x = i32(uv.x * uniform.textureSize.x);
    let y = i32(uv.y * uniform.textureSize.y);
    let idx = y * i32(uniform.textureSize.x) + x;

    if (f32(idx) >= uniform.elementCount) {
        output.color = vec4f(0.2, 0.2, 0.2, 1.0);
        return output;
    }

#ifdef SORTED
    let originalIndex = sortedIndices[idx];
    let value = f32(keysBuffer[originalIndex]);
#else
    let value = f32(keysBuffer[idx]);
#endif

    let normalized = value / uniform.maxValue;
    let color = mix(vec3f(0.1, 0.2, 0.8), vec3f(0.9, 0.3, 0.1), normalized);
    output.color = vec4f(color, 1.0);
    return output;
}

