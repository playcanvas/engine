export default /* wgsl */`
var means_l: texture_2d<f32>;
var means_u: texture_2d<f32>;

uniform numSplats: u32;
uniform means_mins: vec3f;
uniform means_maxs: vec3f;

@fragment
fn fragmentMain(input: FragmentInput) -> FragmentOutput {
    var output: FragmentOutput;

    let w: u32 = textureDimensions(means_l, 0).x;
    let uv: vec2<i32> = vec2<i32>(input.position.xy);
    if (u32(uv.x + uv.y * i32(w)) >= uniform.numSplats) {
        discard;
        return output;
    }

    let l: vec3f = textureLoad(means_l, uv, 0).xyz;
    let u: vec3f = textureLoad(means_u, uv, 0).xyz;
    let n: vec3f = (l * 255.0 + u * 255.0 * 256.0) / 65535.0;
    let v: vec3f = mix(uniform.means_mins, uniform.means_maxs, n);
    let center: vec3f = sign(v) * (exp(abs(v)) - 1.0);

    let packed: vec4<u32> = bitcast<vec4<u32>>(vec4f(center, 0.0));
    output.color = packed;
    return output;
}
`;

