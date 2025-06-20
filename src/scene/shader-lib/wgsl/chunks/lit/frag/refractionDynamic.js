export default /* wgsl */`
uniform material_invAttenuationDistance: f32;
uniform material_attenuation: vec3f;

fn evalRefractionColor(refractionVector: vec3f, gloss: f32, refractionIndex: f32) -> vec3f {

    // The refraction point is the entry point + vector to exit point
    let pointOfRefraction: vec4f = vec4f(vPositionW + refractionVector, 1.0);

    // Project to texture space so we can sample it
    let projectionPoint: vec4f = uniform.matrix_viewProjection * pointOfRefraction;

    // use built-in getGrabScreenPos function to convert screen position to grab texture uv coords
    let uv: vec2f = getGrabScreenPos(projectionPoint);

    // Use IOR and roughness to select mip
    let iorToRoughness: f32 = (1.0 - gloss) * clamp((1.0 / refractionIndex) * 2.0 - 2.0, 0.0, 1.0);
    let refractionLod: f32 = log2(uniform.uScreenSize.x) * iorToRoughness;
    let refraction: vec3f = textureSampleLevel(uSceneColorMap, uSceneColorMapSampler, uv, refractionLod).rgb;

    return refraction;
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
    dispersion: f32,
#if defined(LIT_IRIDESCENCE)
    iridescenceFresnel: vec3f,
    iridescenceIntensity: f32
#endif
) {

    // Extract scale from the model transform
    var modelScale: vec3f;
    modelScale.x = length(uniform.matrix_model[0].xyz);
    modelScale.y = length(uniform.matrix_model[1].xyz);
    modelScale.z = length(uniform.matrix_model[2].xyz);

    // Calculate the refraction vector, scaled by the thickness and scale of the object
    let scale: vec3f = thickness * modelScale;
    var refractionVector = normalize(refract(-viewDir, worldNormal, refractionIndex)) * scale;
    var refraction = evalRefractionColor(refractionVector, gloss, refractionIndex);

    #ifdef LIT_DISPERSION
        // based on the dispersion material property, calculate modified refraction index values
        // for R and B channels and evaluate the refraction color for them.
        let halfSpread: f32 = (1.0 / refractionIndex - 1.0) * 0.025 * dispersion;

        let refractionIndexR: f32 = refractionIndex - halfSpread;
        refractionVector = normalize(refract(-viewDir, worldNormal, refractionIndexR)) * scale;
        refraction.r = evalRefractionColor(refractionVector, gloss, refractionIndexR).r;

        let refractionIndexB: f32 = refractionIndex + halfSpread;
        refractionVector = normalize(refract(-viewDir, worldNormal, refractionIndexB)) * scale;
        refraction.b = evalRefractionColor(refractionVector, gloss, refractionIndexB).b;
    #endif

    // Transmittance is our final refraction color
    var transmittance: vec3f;
    if (uniform.material_invAttenuationDistance != 0.0)
    {
        let attenuation: vec3f = -log(uniform.material_attenuation) * uniform.material_invAttenuationDistance;
        transmittance = exp(-attenuation * length(refractionVector));
    }
    else
    {
        transmittance = refraction;
    }

    // Apply fresnel effect on refraction
    let fresnel: vec3f = vec3f(1.0) -
        getFresnel(
            dot(viewDir, worldNormal),
            gloss,
            specularity
        #if defined(LIT_IRIDESCENCE)
            , iridescenceFresnel,
            iridescenceIntensity
        #endif
        );
    dDiffuseLight = mix(dDiffuseLight, refraction * transmittance * fresnel, transmission);
}
`;
