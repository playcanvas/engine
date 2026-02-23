// SOG GSplat format - work variables, helpers, and read functions
// packedTexture is auto-generated from GSplatFormat streams
export default /* wgsl */`
#include "gsplatPackingPS"

// uniform declarations for dequantization
uniform means_mins: vec3f;
uniform means_maxs: vec3f;

uniform scales_mins: f32;
uniform scales_maxs: f32;

// SH0 color uniforms
uniform sh0_mins: f32;
uniform sh0_maxs: f32;

// SH0 texture for color
var packedSh0: texture_2d<f32>;

// SH_C0 coefficient for 0th degree spherical harmonic
const SH_C0: f32 = 0.28209479177387814;

// work value
var<private> packedSample: vec4<u32>;

const norm: f32 = sqrt(2.0);

// read the model-space center of the gaussian
fn getCenter() -> vec3f {
    // read the packed texture sample using generated load function (uses global splat.uv)
    packedSample = loadPackedTexture();

    let l = unpack8888(packedSample.x).xyz;
    let u = unpack8888(packedSample.y).xyz;
    let n = (l + u * 256.0) / 257.0;
    let v = mix(uniform.means_mins, uniform.means_maxs, n);

    return sign(v) * (exp(abs(v)) - 1.0);
}

fn getColor() -> vec4f {
    let clr = mix(half3(half(uniform.sh0_mins)), half3(half(uniform.sh0_maxs)), half3(unpack111110(pack8888(textureLoad(packedSh0, splat.uv, 0)))));
    let alpha = half(f32(packedSample.z & 0xffu) / 255.0);
    return vec4f(half4(half3(0.5) + clr * half(SH_C0), alpha));
}

fn getRotation() -> vec4f {
    let qdata = unpack8888(packedSample.z).xyz;
    let qmode = packedSample.w & 0x3u;
    let abc = (qdata - 0.5) * norm;
    let d = sqrt(max(0.0, 1.0 - dot(abc, abc)));

    var quat: vec4f;
    if (qmode == 0u) {
        quat = vec4f(d, abc);
    } else if (qmode == 1u) {
        quat = vec4f(abc.x, d, abc.y, abc.z);
    } else if (qmode == 2u) {
        quat = vec4f(abc.x, abc.y, d, abc.z);
    } else {
        quat = vec4f(abc.x, abc.y, abc.z, d);
    }
    return quat;
}

fn getScale() -> vec3f {
    let sdata = unpack101010(packedSample.w >> 2u);
    return exp(mix(vec3f(uniform.scales_mins), vec3f(uniform.scales_maxs), sdata));
}

#include "gsplatSogSHVS"
`;
