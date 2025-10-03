export default /* wgsl */`
var packedSh0: texture_2d<f32>;

uniform sh0_mins: f32;
uniform sh0_maxs: f32;

const SH_C0: f32 = 0.28209479177387814;

fn readColor(source: ptr<function, SplatSource>) -> vec4f {
    let clr = mix(vec3f(uniform.sh0_mins), vec3f(uniform.sh0_maxs), unpack111110(pack8888(textureLoad(packedSh0, source.uv, 0))));
    let alpha = f32(packedSample.z & 0xffu) / 255.0;
    return vec4f(vec3f(0.5) + clr.xyz * SH_C0, alpha);
}
`;
