export default /* wgsl */`
// ----- Directional/Spot Sampling -----

fn getShadowPCF1x1(shadowMap: texture_depth_2d, shadowMapSampler: sampler_comparison, shadowCoord: vec3f, shadowParams: vec4f) -> f32 {
    return textureSampleCompareLevel(shadowMap, shadowMapSampler, shadowCoord.xy, shadowCoord.z);
}

fn getShadowSpotPCF1x1(shadowMap: texture_depth_2d, shadowMapSampler: sampler_comparison, shadowCoord: vec3f, shadowParams: vec4f) -> f32 {
    return textureSampleCompareLevel(shadowMap, shadowMapSampler, shadowCoord.xy, shadowCoord.z);
}

// ----- Omni Sampling -----

// Not supported on WebGPU device
// fn getShadowOmniPCF1x1(shadowMap: texture_depth_cube, shadowMapSampler: sampler_comparison, shadowCoord: vec3f, shadowParams: vec4f, lightDir: vec3f) -> f32 {
//     let shadowZ: f32 = length(lightDir) * shadowParams.w + shadowParams.z;
//     return textureSampleCompareLevel(shadowMap, shadowMapSampler, lightDir, shadowZ);
// }
`;
