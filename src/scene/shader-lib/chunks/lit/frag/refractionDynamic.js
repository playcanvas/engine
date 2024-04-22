export default /* glsl */`
uniform float material_invAttenuationDistance;
uniform vec3 material_attenuation;

vec3 evalRefractionColor(vec3 refractionVector, float gloss, float refractionIndex) {

    // The refraction point is the entry point + vector to exit point
    vec4 pointOfRefraction = vec4(vPositionW + refractionVector, 1.0);

    // Project to texture space so we can sample it
    vec4 projectionPoint = matrix_viewProjection * pointOfRefraction;

    // use built-in getGrabScreenPos function to convert screen position to grab texture uv coords
    vec2 uv = getGrabScreenPos(projectionPoint);

    #ifdef SUPPORTS_TEXLOD
        // Use IOR and roughness to select mip
        float iorToRoughness = (1.0 - gloss) * clamp((1.0 / refractionIndex) * 2.0 - 2.0, 0.0, 1.0);
        float refractionLod = log2(uScreenSize.x) * iorToRoughness;
        vec3 refraction = texture2DLodEXT(uSceneColorMap, uv, refractionLod).rgb;
    #else
        vec3 refraction = texture2D(uSceneColorMap, uv).rgb;
    #endif

    return refraction;
}

void addRefraction(
    vec3 worldNormal, 
    vec3 viewDir, 
    float thickness, 
    float gloss, 
    vec3 specularity, 
    vec3 albedo, 
    float transmission,
    float refractionIndex,
    float dispersion
#if defined(LIT_IRIDESCENCE)
    , vec3 iridescenceFresnel,
    float iridescenceIntensity
#endif
) {

    // Extract scale from the model transform
    vec3 modelScale;
    modelScale.x = length(vec3(matrix_model[0].xyz));
    modelScale.y = length(vec3(matrix_model[1].xyz));
    modelScale.z = length(vec3(matrix_model[2].xyz));

    // Calculate the refraction vector, scaled by the thickness and scale of the object
    vec3 scale = thickness * modelScale;
    vec3 refractionVector = normalize(refract(-viewDir, worldNormal, refractionIndex)) * scale;
    vec3 refraction = evalRefractionColor(refractionVector, gloss, refractionIndex);

    #ifdef DISPERSION
        // based on the dispersion material property, calculate modified refraction index values
        // for R and B channels and evaluate the refraction color for them.
        float halfSpread = (1.0 / refractionIndex - 1.0) * 0.025 * dispersion;

        float refractionIndexR = refractionIndex - halfSpread;
        refractionVector = normalize(refract(-viewDir, worldNormal, refractionIndexR)) * scale;
        refraction.r = evalRefractionColor(refractionVector, gloss, refractionIndexR).r;

        float refractionIndexB = refractionIndex + halfSpread;
        refractionVector = normalize(refract(-viewDir, worldNormal, refractionIndexB)) * scale;
        refraction.b = evalRefractionColor(refractionVector, gloss, refractionIndexB).b;
    #endif

    // Transmittance is our final refraction color
    vec3 transmittance;
    if (material_invAttenuationDistance != 0.0)
    {
        vec3 attenuation = -log(material_attenuation) * material_invAttenuationDistance;
        transmittance = exp(-attenuation * length(refractionVector));
    }
    else
    {
        transmittance = refraction;
    }

    // Apply fresnel effect on refraction
    vec3 fresnel = vec3(1.0) - 
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
