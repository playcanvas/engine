var keysTexture: texture_2d<u32>;

uniform maxValue: f32;
uniform elementCount: f32;
uniform textureSize: vec2f;
uniform debugMode: f32;

varying vUv0: vec2f;

@fragment
fn fragmentMain(input: FragmentInput) -> FragmentOutput {
    var output: FragmentOutput;
    let uv = input.vUv0;

    // Debug mode: show UVs as colors
    if (uniform.debugMode > 0.5) {
        output.color = vec4f(uv.x, uv.y, 0.0, 1.0);
        return output;
    }

    let x = i32(uv.x * uniform.textureSize.x);
    let y = i32(uv.y * uniform.textureSize.y);
    let idx = y * i32(uniform.textureSize.x) + x;

    if (f32(idx) >= uniform.elementCount) {
        output.color = vec4f(0.2, 0.2, 0.2, 1.0);
        return output;
    }

    let value = f32(textureLoad(keysTexture, vec2i(x, y), 0).r);
    let normalized = value / uniform.maxValue;

    let color = mix(vec3f(0.1, 0.2, 0.8), vec3f(0.9, 0.3, 0.1), normalized);
    output.color = vec4f(color, 1.0);
    return output;
}

