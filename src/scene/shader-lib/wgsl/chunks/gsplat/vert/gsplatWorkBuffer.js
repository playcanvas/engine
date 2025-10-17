export default /* wgsl */`
var splatTexture0: texture_2d<u32>;
var splatTexture1: texture_2d<u32>;
var splatColor: texture_2d<uff>;

// cached texture fetches
var<private> cachedSplatTexture0Data: vec4u;
var<private> cachedSplatTexture1Data: vec2u;

// load splat textures into globals to avoid redundant fetches
fn loadSplatTextures(source: ptr<function, SplatSource>) {
    cachedSplatTexture0Data = textureLoad(splatTexture0, source.uv, 0);
    cachedSplatTexture1Data = textureLoad(splatTexture1, source.uv, 0).xy;
}

// read the model-space center of the gaussian
fn readCenter(source: ptr<function, SplatSource>) -> vec3f {
    return vec3f(bitcast<f32>(cachedSplatTexture0Data.r), bitcast<f32>(cachedSplatTexture0Data.g), bitcast<f32>(cachedSplatTexture0Data.b));
}

// sample covariance vectors
fn readCovariance(source: ptr<function, SplatSource>, cov_A: ptr<function, vec3f>, cov_B: ptr<function, vec3f>) {
    let covAxy = unpack2x16float(cachedSplatTexture1Data.x);
    let covBxy = unpack2x16float(cachedSplatTexture1Data.y);
    let covAzBz = unpack2x16float(cachedSplatTexture0Data.a);
    *cov_A = vec3f(covAxy, covAzBz.x);
    *cov_B = vec3f(covBxy, covAzBz.y);
}

fn readColor(source: ptr<function, SplatSource>) -> vec4f {
    return textureLoad(splatColor, source.uv, 0);
}   
`;
