export default /* wgsl */`
fn refract2(viewVec: vec3f, normal: vec3f, IOR: f32) -> vec3f {
    let vn: f32 = dot(viewVec, normal);
    let k: f32 = 1.0 - IOR * IOR * (1.0 - vn * vn);
    let refrVec: vec3f = IOR * viewVec - (IOR * vn + sqrt(k)) * normal;
    return refrVec;
}

fn addRefraction(
    worldNormal: vec3f,
    viewDir: vec3f,
    thickness: f32,
    gloss: f32,
    specularity: vec3f,
    albedo: vec3f,
    transmission: f32,
    refractionIndex: f32,
    dispersion: f32
#if defined(LIT_IRIDESCENCE)
    , iridescenceFresnel: vec3f,
    iridescenceIntensity: f32
#endif
) {
    // use same reflection code with refraction vector
    let tmpRefl: vec4f = dReflection;
    let reflectionDir: vec3f = refract2(-viewDir, worldNormal, refractionIndex);
    dReflection = vec4f(0.0);
    addReflection(reflectionDir, gloss);
    dDiffuseLight = mix(dDiffuseLight, dReflection.rgb * albedo, transmission);
    dReflection = tmpRefl;
}
`;
