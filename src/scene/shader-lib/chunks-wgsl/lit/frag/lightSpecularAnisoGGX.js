export default /* wgsl */`
// Anisotropic GGX
fn calcLightSpecular(gloss: f32, worldNormal: vec3f, viewDir: vec3f, h: vec3f, lightDirNorm: vec3f, tbn: mat3x3f) -> f32 {
    let PI: f32 = 3.141592653589793;
    let roughness: f32 = max((1.0 - gloss) * (1.0 - gloss), 0.001);
    let anisotropy: f32 = uniform.material_anisotropy * roughness;

    let at: f32 = max((roughness + anisotropy), roughness / 4.0);
    let ab: f32 = max((roughness - anisotropy), roughness / 4.0);

    let NoH: f32 = dot(worldNormal, h);
    let ToH: f32 = dot(tbn[0], h);
    let BoH: f32 = dot(tbn[1], h);

    let a2: f32 = at * ab;
    let v: vec3f = vec3f(ab * ToH, at * BoH, a2 * NoH);
    let v2: f32 = dot(v, v);
    let w2: f32 = a2 / v2;
    let D: f32 = a2 * w2 * w2 * (1.0 / PI);

    let ToV: f32 = dot(tbn[0], viewDir);
    let BoV: f32 = dot(tbn[1], viewDir);
    let ToL: f32 = dot(tbn[0], -lightDirNorm);
    let BoL: f32 = dot(tbn[1], -lightDirNorm);
    let NoV: f32 = dot(worldNormal, viewDir);
    let NoL: f32 = dot(worldNormal, -lightDirNorm);

    let lambdaV: f32 = NoL * length(vec3f(at * ToV, ab * BoV, NoV));
    let lambdaL: f32 = NoV * length(vec3f(at * ToL, ab * BoL, NoL));
    let G: f32 = 0.5 / (lambdaV + lambdaL);

    return D * G;
}

fn getLightSpecular(h: vec3f, reflDir: vec3f, worldNormal: vec3f, viewDir: vec3f, lightDirNorm: vec3f, gloss: f32, tbn: mat3x3f) -> f32 {
    return calcLightSpecular(gloss, worldNormal, viewDir, h, lightDirNorm, tbn);
}
`;
