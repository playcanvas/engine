export default /* wgsl */`
#include "gsplatPackingPS"

var packedTexture: texture_2d<u32>;

uniform means_mins: vec3f;
uniform means_maxs: vec3f;

uniform scales_mins: f32;
uniform scales_maxs: f32;

var<private> packedSample: vec4<u32>;

// read the model-space center of the gaussian
fn readCenter(source: ptr<function, SplatSource>) -> vec3f {

    packedSample = textureLoad(packedTexture, source.uv, 0);

    let l = unpack8888(packedSample.x).xyz;
    let u = unpack8888(packedSample.y).xyz;
    let n = (l + u * 256.0) / 257.0;
    let v = mix(uniform.means_mins, uniform.means_maxs, n);

    return sign(v) * (exp(abs(v)) - 1.0);
}

const norm: f32 = sqrt(2.0);

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
`;
