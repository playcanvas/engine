// Work buffer format - reads from sorted work buffer in unified rendering mode
export default /* wgsl */`
var splatTexture0: texture_2d<u32>;
var splatTexture1: texture_2d<u32>;
var splatColor: texture_2d<uff>;

// cached texture fetches
var<private> cachedSplatTexture0Data: vec4u;
var<private> cachedSplatTexture1Data: vec2u;

// read the model-space center of the gaussian
fn getCenter(source: ptr<function, SplatSource>) -> vec3f {
    cachedSplatTexture0Data = textureLoad(splatTexture0, source.uv, 0);
    cachedSplatTexture1Data = textureLoad(splatTexture1, source.uv, 0).xy;
    return vec3f(bitcast<f32>(cachedSplatTexture0Data.r), bitcast<f32>(cachedSplatTexture0Data.g), bitcast<f32>(cachedSplatTexture0Data.b));
}

fn getRotation() -> vec4f {
    let rotXY = unpack2x16float(cachedSplatTexture0Data.a);
    let rotZscaleX = unpack2x16float(cachedSplatTexture1Data.x);
    let rotXYZ = vec3f(rotXY, rotZscaleX.x);
    return vec4f(rotXYZ, sqrt(max(0.0, 1.0 - dot(rotXYZ, rotXYZ)))).wxyz;
}

fn getScale() -> vec3f {
    let rotZscaleX = unpack2x16float(cachedSplatTexture1Data.x);
    let scaleYZ = unpack2x16float(cachedSplatTexture1Data.y);
    return vec3f(rotZscaleX.y, scaleYZ);
}

fn getColor(source: ptr<function, SplatSource>) -> vec4f {
    return textureLoad(splatColor, source.uv, 0);
}   
`;
