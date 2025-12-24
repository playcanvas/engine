export default /* wgsl */`
// Schlick's approximation (glTF 2.0 compliant)
// F = F0 + (F90 - F0) * (1 - V·H)^5, where F90 = 1.0
fn getFresnel(
        cosTheta: f32,
        gloss: f32,
        specularity: vec3f
    #if defined(LIT_IRIDESCENCE)
        , iridescenceFresnel: vec3f,
        iridescenceIntensity: f32
    #endif
) -> vec3f {
    let fresnel: f32 = pow(1.0 - saturate(cosTheta), 5.0);
    let ret: vec3f = specularity + (vec3f(1.0) - specularity) * fresnel;

    #if defined(LIT_IRIDESCENCE)
        return mix(ret, iridescenceFresnel, iridescenceIntensity);
    #else
        return ret;
    #endif
}

fn getFresnelCC(cosTheta: f32) -> f32 {
    let fresnel: f32 = pow(1.0 - saturate(cosTheta), 5.0);
    return 0.04 + (1.0 - 0.04) * fresnel;
}`;
