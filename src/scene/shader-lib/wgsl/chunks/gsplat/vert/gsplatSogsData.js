export default /* wgsl */`
var packedTexture: texture_2d<u32>;

uniform means_mins: vec3f;
uniform means_maxs: vec3f;

uniform scales_mins: vec3f;
uniform scales_maxs: vec3f;

vec4 unpackU32(u: u32) -> vec4f {
    return vec4f(
        f32((u >> 24u) & 0xFFu) / 255.0,
        f32((u >> 16u) & 0xFFu) / 255.0,
        f32((u >> 8u) & 0xFFu) / 255.0,
        f32(u & 0xFFu) / 255.0
    );
}

vec4<u32> packedSample;

// read the model-space center of the gaussian
fn readCenter(source: ptr<function, SplatSource>) -> vec3f {

    packedSample = textureLoad(packedTexture, source.uv, 0);

    let l: vec3f = unpackU32(packedSample.x).xyz;
    let u: vec3f = unpackU32(packedSample.y).xyz;
    let n: vec3f = (l * 255.0 + u * 255.0 * 256.0) / 65535.0;
    let v: vec3f = mix(uniform.means_mins, uniform.means_maxs, n);

    return sign(v) * (exp(abs(v)) - 1.0);
}

const norm: f32 = 2.0 / sqrt(2.0);

// sample covariance vectors
fn readCovariance(source: ptr<function, SplatSource>, covA_ptr: ptr<function, vec3f>, covB_ptr: ptr<function, vec3f>) {
    let qdata: vec4f = unpackU32(packedSample.z);
    let sdata: vec3f = unpackU32(packedSample.w).xyz;

    let abc: vec3f = (qdata.xyz - 0.5) * norm;
    let d: f32 = sqrt(max(0.0, 1.0 - dot(abc, abc)));

    let mode: u32 = u32(qdata.w * 255.0 + 0.5) - 252u;

    var quat: vec4f;
    if (mode == 0u) {
        quat = vec4f(d, abc);
    } else if (mode == 1u) {
        quat = vec4f(abc.x, d, abc.y, abc.z);
    } else if (mode == 2u) {
        quat = vec4f(abc.x, abc.y, d, abc.z);
    } else {
        quat = vec4f(abc.x, abc.y, abc.z, d);
    }


    let rot: mat3x3f = quatToMat3(quat);
    let scale: vec3f = exp(mix(uniform.scales_mins, uniform.scales_maxs, sdata));

    // M = S * R
    let M: mat3x3f = transpose(mat3x3f(
        scale.x * rot[0],
        scale.y * rot[1],
        scale.z * rot[2]
    ));

    *covA_ptr = vec3f(dot(M[0], M[0]), dot(M[0], M[1]), dot(M[0], M[2]));
    *covB_ptr = vec3f(dot(M[1], M[1]), dot(M[1], M[2]), dot(M[2], M[2]));
}
`;
