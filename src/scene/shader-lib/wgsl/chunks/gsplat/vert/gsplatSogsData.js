export default /* wgsl */`
var means_u: texture_2d<f32>;
var means_l: texture_2d<f32>;
var quats: texture_2d<f32>;
var scales: texture_2d<f32>;

uniform means_mins: vec3f;
uniform means_maxs: vec3f;

uniform scales_mins: vec3f;
uniform scales_maxs: vec3f;

// read the model-space center of the gaussian
fn readCenter(source: ptr<function, SplatSource>) -> vec3f {
    let u: vec3f = textureLoad(means_u, source.uv, 0).xyz;
    let l: vec3f = textureLoad(means_l, source.uv, 0).xyz;
    let n: vec3f = (l * 255.0 + u * 255.0 * 256.0) / 65535.0;

    let v: vec3f = mix(uniform.means_mins, uniform.means_maxs, n);
    return sign(v) * (exp(abs(v)) - 1.0);
}

const norm: f32 = 2.0 / sqrt(2.0);

// sample covariance vectors
fn readCovariance(source: ptr<function, SplatSource>, covA_ptr: ptr<function, vec3f>, covB_ptr: ptr<function, vec3f>) {
    let qdata: vec4f = textureLoad(quats, source.uv, 0);
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
    let scale: vec3f = exp(mix(uniform.scales_mins, uniform.scales_maxs, textureLoad(scales, source.uv, 0).xyz));

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
