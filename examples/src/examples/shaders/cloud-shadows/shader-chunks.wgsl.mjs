/**
 * WGSL shader chunks for the cloud shadows example.
 * These chunks override StandardMaterial to add scrolling cloud shadow modulation.
 */

export const litUserDeclarationPS = /* wgsl */ `
    var cloudShadowTexture: texture_2d<f32>;
    var cloudShadowTextureSampler: sampler;
    uniform cloudShadowOffset: vec2f;
    uniform cloudShadowScale: f32;
    uniform cloudShadowIntensity: f32;
`;

// Override endPS to apply cloud shadow after combineColor but before emission/fog/tonemap/gamma
export const endPS = /* wgsl */ `
    var finalRgb: vec3f = combineColor(litArgs_albedo, litArgs_sheen_specularity, litArgs_clearcoat_specularity);

    let cloudUV: vec2f = vPositionW.xz * uniform.cloudShadowScale + uniform.cloudShadowOffset;
    let cloud: f32 = textureSample(cloudShadowTexture, cloudShadowTextureSampler, cloudUV).r;
    finalRgb = finalRgb * mix(1.0, cloud, uniform.cloudShadowIntensity);

    finalRgb = finalRgb + litArgs_emission;
    finalRgb = addFog(finalRgb);
    finalRgb = toneMap(finalRgb);
    finalRgb = gammaCorrectOutput(finalRgb);
    output.color = vec4f(finalRgb, output.color.a);
`;
