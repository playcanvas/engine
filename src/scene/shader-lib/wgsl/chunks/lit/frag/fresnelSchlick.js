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
    // pow(x, 5) expanded into multiplies to avoid the log2/exp2 pair pow compiles to
    let x: f32 = 1.0 - saturate(cosTheta);
    let x2: f32 = x * x;
    let fresnel: f32 = x2 * x2 * x;
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
    // pow(x, 5) expanded into multiplies to avoid the log2/exp2 pair pow compiles to
    let x: f32 = 1.0 - saturate(cosTheta);
    let x2: f32 = x * x;
    let fresnel: f32 = x2 * x2 * x;
    return 0.04 + (1.0 - 0.04) * fresnel;
}`;
