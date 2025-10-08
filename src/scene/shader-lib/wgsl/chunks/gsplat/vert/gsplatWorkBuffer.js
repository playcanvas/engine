export default /* wgsl */`
var center: texture_2d<uff>;
var covA: texture_2d<uff>;
var covB: texture_2d<uff>;
var splatColor: texture_2d<uff>;

// read the model-space center of the gaussian
fn readCenter(source: ptr<function, SplatSource>) -> vec3f {
    return textureLoad(center, source.uv, 0).xyz;
}

// sample covariance vectors
fn readCovariance(source: ptr<function, SplatSource>, cov_A: ptr<function, vec3f>, cov_B: ptr<function, vec3f>) {
    *cov_A = textureLoad(covA, source.uv, 0).xyz;
    *cov_B = textureLoad(covB, source.uv, 0).xyz;
}

fn readColor(source: ptr<function, SplatSource>) -> vec4f {
    return textureLoad(splatColor, source.uv, 0);
}   
`;
