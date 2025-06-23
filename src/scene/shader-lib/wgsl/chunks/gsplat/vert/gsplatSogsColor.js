export default /* wgsl */`
var sh0: texture_2d<f32>;
var sh_labels: texture_2d<f32>;
var sh_result: texture_2d<f32>;

uniform sh0_mins: vec4f;
uniform sh0_maxs: vec4f;

const SH_C0: f32 = 0.28209479177387814;

fn readColor(source: ptr<function, SplatSource>) -> vec4f {
    // sample base color
    let baseSample: vec4f = mix(uniform.sh0_mins, uniform.sh0_maxs, textureLoad(sh0, source.uv, 0));
    let base = vec4f(vec3f(0.5) + baseSample.xyz * SH_C0, 1.0 / (1.0 + exp(-baseSample.w)));

    // extract spherical harmonics palette index
    let labelSample: vec2i = vec2i(textureLoad(sh_labels, source.uv, 0).xy * 255.0);
    let n = labelSample.x + labelSample.y * 256;

    let shSample: vec3f = textureLoad(sh_result, vec2i(n % 64, n / 64), 0).xyz;
    let sh: vec3f = (shSample - vec3f(0.5)) * 4.0;

    return vec4f(base.xyz + sh, base.w);
}
`;
