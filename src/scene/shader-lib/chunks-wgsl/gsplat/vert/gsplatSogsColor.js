export default /* wgsl */`
var sh0: texture_2d<f32>;

uniform sh0_mins: vec4f;
uniform sh0_maxs: vec4f;

const SH_C0: f32 = 0.28209479177387814;

fn readColor(source: ptr<function, SplatSource>) -> vec4f {
    let clr: vec4f = mix(sh0_mins, sh0_maxs, textureLoad(sh0, source.uv, 0));
    return vec4f(vec3f(0.5) + clr.xyz * SH_C0, 1.0 / (1.0 + exp(-clr.w)));
}
`;
