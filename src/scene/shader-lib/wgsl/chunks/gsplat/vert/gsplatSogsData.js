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
    let n = (l * 255.0 + u * 255.0 * 256.0) / 65535.0;
    let v = mix(uniform.means_mins, uniform.means_maxs, n);

    return sign(v) * (exp(abs(v)) - 1.0);
}

const norm: f32 = 2.0 / sqrt(2.0);

// sample covariance vectors
fn readCovariance(source: ptr<function, SplatSource>, covA_ptr: ptr<function, vec3f>, covB_ptr: ptr<function, vec3f>) {
    let qdata = unpack8888(packedSample.z).xyz;
    let sdata = unpack101010(packedSample.w >> 2u);

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

    let rot = quatToMat3(quat);
    let scale = exp(mix(vec3f(uniform.scales_mins), vec3f(uniform.scales_maxs), sdata));

    // M = S * R
    let M = transpose(mat3x3f(
        scale.x * rot[0],
        scale.y * rot[1],
        scale.z * rot[2]
    ));

    *covA_ptr = vec3f(dot(M[0], M[0]), dot(M[0], M[1]), dot(M[0], M[2]));
    *covB_ptr = vec3f(dot(M[1], M[1]), dot(M[1], M[2]), dot(M[2], M[2]));
}
`;
