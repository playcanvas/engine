export default /* wgsl */`
var sh0: texture_2d<f32>;
var sh_labels: texture_2d<f32>;
var sh_result: texture_2d<f32>;

uniform sh0_mins: vec4f;
uniform sh0_maxs: vec4f;

const SH_C0: f32 = 0.28209479177387814;

// unpack 11, 11, 10 normalized value from rgba8 texture sample
fn unpackRgb(v: vec4f) -> vec3f {
    let bits = dot(vec4u(v * 255.0), vec4u(1u << 24, 1u << 16, 1u << 8, 1u));
    let vb = (vec3u(bits) >> vec3u(21, 10, 0)) & vec3u(0x7ffu, 0x7ffu, 0x3ffu);
    return vec3f(vb) / vec3f(2047.0, 2047.0, 1023.0);
}

fn readColor(source: ptr<function, SplatSource>) -> vec4f {
    // sample base color
    let baseSample: vec4f = mix(uniform.sh0_mins, uniform.sh0_maxs, textureLoad(sh0, source.uv, 0));
    let base = vec4f(vec3f(0.5) + baseSample.xyz * SH_C0, 1.0 / (1.0 + exp(-baseSample.w)));

    // extract spherical harmonics palette index
    let labelSample: vec2i = vec2i(textureLoad(sh_labels, source.uv, 0).xy * 255.0);
    let n = labelSample.x + labelSample.y * 256;

    let shSample: vec4f = textureLoad(sh_result, vec2i(n % 64, n / 64), 0);
    let sh: vec3f = (unpackRgb(shSample) - vec3f(0.5)) * 4.0;

    return vec4f(base.xyz + sh, base.w);
}
`;
