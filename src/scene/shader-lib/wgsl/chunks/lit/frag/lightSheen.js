export default /* wgsl */`

fn sheenD(normal: vec3f, h: vec3f, roughness: f32) -> f32 {
    let PI: f32 = 3.141592653589793;
    let invR: f32 = 1.0 / (roughness * roughness);
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
    let D: f32 = sheenD(worldNormal, h, sheenGloss);
    let V: f32 = sheenV(worldNormal, viewDir, -lightDirNorm);
    return D * V;
}`;
