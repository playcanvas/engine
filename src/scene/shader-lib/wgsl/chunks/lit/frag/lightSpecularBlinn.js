export default /* wgsl */`
// Energy-conserving (hopefully) Blinn-Phong
fn calcLightSpecular(gloss: f32, worldNormal: vec3f, h: vec3f) -> f32 {
    let nh: f32 = max( dot( h, worldNormal ), 0.0 );

    var specPow: f32 = exp2(gloss * 11.0); // glossiness is linear, power is not; 0 - 2048

    // Hack: On Mac OS X, calling pow with zero for the exponent generates hideous artifacts so bias up a little
    specPow = max(specPow, 0.0001);

    return pow(nh, specPow) * (specPow + 2.0) / 8.0;
}

fn getLightSpecular(h: vec3f, reflDir: vec3f, worldNormal: vec3f, viewDir: vec3f, lightDirNorm: vec3f, gloss: f32, tbn: mat3x3f) -> f32 {
    return calcLightSpecular(gloss, worldNormal, h);
}
`;
