struct ub_compute {
    tint : vec4f,
    offset: f32,
    frequency: f32
}

@group(0) @binding(0) var<uniform> ubCompute : ub_compute;
@group(0) @binding(1) var inputTexture: texture_2d<f32>;
@group(0) @binding(2) var outputTexture: texture_storage_2d<rgba8unorm, write>;

@compute @workgroup_size(1, 1, 1)
fn main(@builtin(global_invocation_id) global_id : vec3u) {

    let uv = vec2i(global_id.xy);

    // load a color from the source texture
    var texColor = textureLoad(inputTexture, uv, 0);

    // tint it
    var tintColor: vec4f = ubCompute.tint;
    texColor *= tintColor;

    // scroll a darkness effect over the texture
    let uvFloat = vec2f(f32(uv.x), f32(uv.y));
    var darkness: f32 = sin(ubCompute.offset + ubCompute.frequency * length(uvFloat)) * 0.2 + 0.8;
    texColor *= darkness;

    // write it to the output texture
    textureStore(outputTexture, vec2i(global_id.xy), texColor);
}
