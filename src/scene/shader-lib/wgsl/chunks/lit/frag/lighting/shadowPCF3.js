export default /* wgsl */`
// ----- Directional/Spot Sampling -----
fn _getShadowPCF3x3(shadowMap: texture_depth_2d, shadowMapSampler: sampler_comparison, shadowCoord: vec3f, shadowParams: vec3f) -> f32 {
    let z: f32 = shadowCoord.z;
    let uv: vec2f = shadowCoord.xy * shadowParams.x; // 1 unit - 1 texel
    let shadowMapSizeInv: f32 = 1.0 / shadowParams.x;
    let base_uv_temp: vec2f = floor(uv + 0.5);
    let s: f32 = (uv.x + 0.5 - base_uv_temp.x);
    let t: f32 = (uv.y + 0.5 - base_uv_temp.y);
    let base_uv: vec2f = (base_uv_temp - vec2f(0.5)) * shadowMapSizeInv;

    var sum: f32 = 0.0;

    let uw0: f32 = (3.0 - 2.0 * s);
    let uw1: f32 = (1.0 + 2.0 * s);

    let u0_offset: f32 = (2.0 - s) / uw0 - 1.0;
    let u1_offset: f32 = s / uw1 + 1.0;

    let vw0: f32 = (3.0 - 2.0 * t);
    let vw1: f32 = (1.0 + 2.0 * t);

    let v0_offset: f32 = (2.0 - t) / vw0 - 1.0;
    let v1_offset: f32 = t / vw1 + 1.0;

    let u0: f32 = u0_offset * shadowMapSizeInv + base_uv.x;
    let v0: f32 = v0_offset * shadowMapSizeInv + base_uv.y;

    let u1: f32 = u1_offset * shadowMapSizeInv + base_uv.x;
    let v1: f32 = v1_offset * shadowMapSizeInv + base_uv.y;

    sum = sum + uw0 * vw0 * textureSampleCompareLevel(shadowMap, shadowMapSampler, vec2f(u0, v0), z);
    sum = sum + uw1 * vw0 * textureSampleCompareLevel(shadowMap, shadowMapSampler, vec2f(u1, v0), z);
    sum = sum + uw0 * vw1 * textureSampleCompareLevel(shadowMap, shadowMapSampler, vec2f(u0, v1), z);
    sum = sum + uw1 * vw1 * textureSampleCompareLevel(shadowMap, shadowMapSampler, vec2f(u1, v1), z);

    sum = sum * (1.0 / 16.0);
    return sum;
}

fn getShadowPCF3x3(shadowMap: texture_depth_2d, shadowMapSampler: sampler_comparison, shadowCoord: vec3f, shadowParams: vec4f) -> f32 {
    return _getShadowPCF3x3(shadowMap, shadowMapSampler, shadowCoord, shadowParams.xyz);
}

fn getShadowSpotPCF3x3(shadowMap: texture_depth_2d, shadowMapSampler: sampler_comparison, shadowCoord: vec3f, shadowParams: vec4f) -> f32 {
    return _getShadowPCF3x3(shadowMap, shadowMapSampler, shadowCoord, shadowParams.xyz);
}

// ----- Omni Sampling -----

// Not currently supported on WebGPU device
// fn getShadowOmniPCF3x3(shadowMap: texture_depth_cube, shadowMapSampler: sampler_comparison, shadowParams: vec4f, dir: vec3f) -> f32 {

//     // Calculate shadow depth from the light direction
//     let shadowZ: f32 = length(dir) * shadowParams.w + shadowParams.z;

//     // offset
//     let texSize_i = textureDimensions(shadowMap, 0);
//     let z: f32 = 1.0 / f32(texSize_i.x);
//     let tc: vec3f = normalize(dir);

//     // average 4 samples - not a strict 3x3 PCF but that's tricky with cubemaps
//     var shadows: vec4f;
//     shadows.x = textureSampleCompareLevel(shadowMap, shadowMapSampler, tc + vec3f( z,  z,  z), shadowZ);
//     shadows.y = textureSampleCompareLevel(shadowMap, shadowMapSampler, tc + vec3f(-z, -z,  z), shadowZ);
//     shadows.z = textureSampleCompareLevel(shadowMap, shadowMapSampler, tc + vec3f(-z,  z, -z), shadowZ);
//     shadows.w = textureSampleCompareLevel(shadowMap, shadowMapSampler, tc + vec3f( z, -z, -z), shadowZ);

//     return dot(shadows, vec4f(0.25));
// }

// fn getShadowOmniPCF3x3_Wrapper(shadowMap: texture_depth_cube, shadowMapSampler: sampler_comparison, shadowCoord: vec3f, shadowParams: vec4f, lightDir: vec3f) -> f32 {
//     return getShadowOmniPCF3x3(shadowMap, shadowMapSampler, shadowParams, lightDir);
// }
`;
