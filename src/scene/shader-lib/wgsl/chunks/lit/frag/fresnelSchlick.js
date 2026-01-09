export default /* wgsl */`
// Schlick's approximation
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
    let glossSq: f32 = gloss * gloss;

    // Scale gloss contribution by specularity intensity to ensure F90 approaches 0 when F0 is 0
    let specIntensity: f32 = max(specularity.r, max(specularity.g, specularity.b));
    let ret: vec3f = specularity + (max(vec3f(glossSq * specIntensity), specularity) - specularity) * fresnel;

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
