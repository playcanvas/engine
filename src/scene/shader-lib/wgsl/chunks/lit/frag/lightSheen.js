export default /* wgsl */`

fn sheenD(normal: vec3f, h: vec3f, roughness: f32) -> f32 {
    let PI: f32 = 3.141592653589793;
    // the floor on alpha keeps the distribution finite as the roughness reaches zero
    let invR: f32 = 1.0 / max(roughness * roughness, 0.001);
    var cos2h: f32 = max(dot(normal, h), 0.0);
    cos2h = cos2h * cos2h;
    let sin2h: f32 = max(1.0 - cos2h, 0.0078125);
    return (2.0 + invR) * pow(sin2h, invR * 0.5) / (2.0 * PI);
}

fn sheenV(normal: vec3f, viewDir: vec3f, light: vec3f) -> f32 {
    let NoV: f32 = max(dot(normal, viewDir), 0.000001);
    let NoL: f32 = max(dot(normal, light), 0.000001);
    return 1.0 / (4.0 * (NoL + NoV - NoL * NoV));
}

fn getLightSpecularSheen(h: vec3f, worldNormal: vec3f, viewDir: vec3f, lightDirNorm: vec3f, sheenGloss: f32) -> f32 {
    let D: f32 = sheenD(worldNormal, h, 1.0 - sheenGloss);
    let V: f32 = sheenV(worldNormal, viewDir, -lightDirNorm);
    return D * V;
}

// The directional albedo E of the sheen BRDF of KHR_materials_sheen is the fraction of the light that
// the sheen layer reflects, for a direction at the given cosine to the normal. It is evaluated from an
// analytic fit of the integrated BRDF, exp(c + a * cosTheta + b * cosTheta^2), which is within 0.02 of
// it for a cosine above 0.03. The coefficients (a, b, c) are rational in the roughness.
fn getSheenAlbedoFit(roughness: f32) -> vec3f {
    // the same floor as on alpha in the distribution
    let r: f32 = max(roughness, 0.0316);
    let a: f32 = -0.7903 / (r - 0.00608) - 1.125 + 0.2059 * r;
    let b: f32 = 0.5984 - 0.4032 / ((r + 0.0907) * (r + 0.0907));
    let c: f32 = 7.104 / (r + 0.5993) - 10.69 + r * (9.704 - 3.705 * r);
    return vec3f(a, b, c);
}

fn getSheenAlbedo(cosTheta: f32, fit: vec3f) -> f32 {
    return min(exp(fit.z + cosTheta * (fit.x + cosTheta * fit.y)), 1.0);
}

// The sheen layer reflects part of the light before it reaches the base layer, which is scaled by
// 1 - max3(sheenColor) * E. These hold the fit for the sheen roughness, the largest component of the
// sheen color, and the scaling for the view direction, which is applied to all of the base layer when
// combining.
var<private> sAlbedoFit: vec3f;
var<private> sMaxColor: f32;
var<private> sAlbedoScaling: f32;

fn calcSheenAlbedoScaling(worldNormal: vec3f, viewDir: vec3f, sheenGloss: f32, sheenColor: vec3f) {
    sAlbedoFit = getSheenAlbedoFit(1.0 - sheenGloss);
    sMaxColor = max(max(sheenColor.r, sheenColor.g), sheenColor.b);
    sAlbedoScaling = max(1.0 - sMaxColor * getSheenAlbedo(max(dot(worldNormal, viewDir), 0.0), sAlbedoFit), 0.0);
}

// For a light, the base layer is scaled by the smaller of the scalings for the view and the light
// direction. The scaling for the view direction is applied when combining, so this returns the rest.
fn getSheenLightScaling(worldNormal: vec3f, lightDirNorm: vec3f) -> f32 {
    let scaling: f32 = max(1.0 - sMaxColor * getSheenAlbedo(max(dot(worldNormal, -lightDirNorm), 0.0), sAlbedoFit), 0.0);
    return min(scaling / max(sAlbedoScaling, 0.0001), 1.0);
}`;
