export default /* wgsl */`
// Isotropic GGX (glTF 2.0 compliant)
fn calcLightSpecular(gloss: f32, worldNormal: vec3f, viewDir: vec3f, h: vec3f, lightDirNorm: vec3f) -> f32 {
    let PI: f32 = 3.141592653589793;
    let roughness: f32 = max((1.0 - gloss) * (1.0 - gloss), 0.001);
    let alpha: f32 = roughness * roughness;

    let NoH: f32 = max(dot(worldNormal, h), 0.0);
    let NoV: f32 = max(dot(worldNormal, viewDir), 0.0);
    let NoL: f32 = max(dot(worldNormal, -lightDirNorm), 0.0);

    // GGX Distribution
    let NoH2: f32 = NoH * NoH;
    let denom: f32 = NoH2 * (alpha - 1.0) + 1.0;
    let D: f32 = alpha / (PI * denom * denom);

    // Smith G (height-correlated)
    let alpha2: f32 = alpha * alpha;
    let lambdaV: f32 = NoL * sqrt(NoV * NoV * (1.0 - alpha2) + alpha2);
    let lambdaL: f32 = NoV * sqrt(NoL * NoL * (1.0 - alpha2) + alpha2);
    let G: f32 = 0.5 / max(lambdaV + lambdaL, 0.00001);

    return D * G;
}

fn getLightSpecular(h: vec3f, reflDir: vec3f, worldNormal: vec3f, viewDir: vec3f, lightDirNorm: vec3f, gloss: f32, tbn: mat3x3f) -> f32 {
    return calcLightSpecular(gloss, worldNormal, viewDir, h, lightDirNorm);
}
`;

