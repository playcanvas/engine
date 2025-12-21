// backend shader implementing material / lighting for the lit material for forward rendering
export default /* wgsl */`
fn evaluateBackend() -> FragmentOutput {

    var output: FragmentOutput;

    // apply SSAO during lighting
    #ifdef LIT_SSAO
        litArgs_ao = litArgs_ao * textureSampleLevel(ssaoTexture, ssaoTextureSampler, pcPosition.xy * uniform.ssaoTextureSizeInv, 0.0).r;
    #endif

    // transform tangent space normals to world space
    #ifdef LIT_NEEDS_NORMAL
        #ifdef LIT_SPECULAR
            getReflDir(litArgs_worldNormal, dViewDirW, litArgs_gloss, dTBN);
        #endif

        #ifdef LIT_CLEARCOAT
            ccReflDirW = normalize(-reflect(dViewDirW, litArgs_clearcoat_worldNormal));
        #endif
    #endif

    #ifdef LIT_SPECULAR_OR_REFLECTION
        #ifdef LIT_METALNESS
            var f0: f32 = 1.0 / litArgs_ior;
            f0 = (f0 - 1.0) / (f0 + 1.0);
            f0 = f0 * f0;
            #ifdef LIT_SPECULARITY_FACTOR
                litArgs_specularity = getSpecularModulate(litArgs_specularity, litArgs_albedo, litArgs_metalness, f0, litArgs_specularityFactor);
            #else
                litArgs_specularity = getSpecularModulate(litArgs_specularity, litArgs_albedo, litArgs_metalness, f0, 1.0);
            #endif
            litArgs_albedo = getAlbedoModulate(litArgs_albedo, litArgs_metalness);
        #endif

        #ifdef LIT_IRIDESCENCE
            var iridescenceFresnel: vec3f = getIridescenceDiffraction(saturate(dot(dViewDirW, litArgs_worldNormal)), litArgs_specularity, litArgs_iridescence_thickness);
        #endif
    #endif

    // ambient
    #ifdef LIT_ADD_AMBIENT
        addAmbient(litArgs_worldNormal);

        #ifdef LIT_SPECULAR
            dDiffuseLight = dDiffuseLight * (1.0 - litArgs_specularity);
        #endif

        // move ambient color out of diffuse (used by Lightmapper, to multiply ambient color by accumulated AO)
        #ifdef LIT_SEPARATE_AMBIENT
            var dAmbientLight: vec3f = dDiffuseLight;
            dDiffuseLight = vec3(0.0);
        #endif
    #endif

    #ifndef LIT_OLD_AMBIENT
        dDiffuseLight = dDiffuseLight * uniform.material_ambient;
    #endif

    #ifdef LIT_AO
        #ifndef LIT_OCCLUDE_DIRECT
            occludeDiffuse(litArgs_ao);
        #endif
    #endif

    #ifdef LIT_LIGHTMAP
        addLightMap(
            litArgs_lightmap, 
            litArgs_lightmapDir, 
            litArgs_worldNormal, 
            dViewDirW, 
            dReflDirW, 
            litArgs_gloss, 
            litArgs_specularity, 
            dVertexNormalW,
            dTBN
        #if defined(LIT_IRIDESCENCE)
            , iridescenceFresnel,
            litArgs_iridescence_intensity
        #endif
        );
    #endif

    #ifdef LIT_LIGHTING || LIT_REFLECTIONS

        #ifdef LIT_REFLECTIONS

            #ifdef LIT_CLEARCOAT
                addReflectionCC(ccReflDirW, litArgs_clearcoat_gloss);
            
                #ifdef LIT_SPECULAR_FRESNEL
                    ccFresnel = getFresnelCC(dot(dViewDirW, litArgs_clearcoat_worldNormal));
                    ccReflection = ccReflection * ccFresnel;
                #else
                    ccFresnel = 0.0;
                #endif
            #endif

            #ifdef LIT_SPECULARITY_FACTOR
                ccReflection = ccReflection * litArgs_specularityFactor;
            #endif

            #ifdef LIT_SHEEN
                addReflectionSheen(litArgs_worldNormal, dViewDirW, litArgs_sheen_gloss);
            #endif

            // Fresnel has to be applied to reflections
            addReflection(dReflDirW, litArgs_gloss);

            #ifdef LIT_FRESNEL_MODEL

                dReflection = vec4f(
                    dReflection.rgb * getFresnel(
                        dot(dViewDirW, litArgs_worldNormal),
                        litArgs_gloss,
                        litArgs_specularity
                    #if defined(LIT_IRIDESCENCE)
                        , iridescenceFresnel,
                        litArgs_iridescence_intensity
                    #endif
                        ),
                    dReflection.a
                );

            #else

                dReflection = vec4f(dReflection.rgb * litArgs_specularity, dReflection.a);

            #endif

        #endif

        #ifdef AREA_LIGHTS
            // specular has to be accumulated differently if we want area lights to look correct
            dSpecularLight = dSpecularLight * litArgs_specularity;

            #ifdef LIT_SPECULAR
                // evaluate material based area lights data, shared by all area lights
                calcLTCLightValues(litArgs_gloss, litArgs_worldNormal, dViewDirW, litArgs_specularity, litArgs_clearcoat_gloss, litArgs_clearcoat_worldNormal, litArgs_clearcoat_specularity);
            #endif
        #endif
        
        // LOOP - evaluate all non-clustered lights
        #ifdef LIGHT_COUNT > 0
            #include "lightEvaluationPS, LIGHT_COUNT"
        #endif

        // clustered lighting
        #ifdef LIT_CLUSTERED_LIGHTS
            addClusteredLights(litArgs_worldNormal, dViewDirW, dReflDirW,
                #if defined(LIT_CLEARCOAT)
                        ccReflDirW,
                #endif
                        litArgs_gloss, litArgs_specularity, dVertexNormalW, dTBN, 
                #if defined(LIT_IRIDESCENCE)
                        iridescenceFresnel,
                #endif
                        litArgs_clearcoat_worldNormal, litArgs_clearcoat_gloss, litArgs_sheen_gloss, litArgs_iridescence_intensity
            );
        #endif

        #ifdef AREA_LIGHTS

            #ifdef LIT_CLEARCOAT
                // specular has to be accumulated differently if we want area lights to look correct
                litArgs_clearcoat_specularity = 1.0;
            #endif

            #ifdef LIT_SPECULAR
                litArgs_specularity = vec3(1.0);
            #endif

        #endif

        #ifdef LIT_REFRACTION
            addRefraction(
                litArgs_worldNormal, 
                dViewDirW, 
                litArgs_thickness, 
                litArgs_gloss, 
                litArgs_specularity, 
                litArgs_albedo, 
                litArgs_transmission,
                litArgs_ior,
                litArgs_dispersion
                #if defined(LIT_IRIDESCENCE)
                    , iridescenceFresnel, 
                    litArgs_iridescence_intensity
                #endif
            );
        #endif
    #endif

    // apply ambient occlusion
    #ifdef LIT_AO
        #ifdef LIT_OCCLUDE_DIRECT
            occludeDiffuse(litArgs_ao);
        #endif

        #if LIT_OCCLUDE_SPECULAR != NONE
            occludeSpecular(litArgs_gloss, litArgs_ao, litArgs_worldNormal, dViewDirW);
        #endif
    #endif

    #if !defined(LIT_OPACITY_FADES_SPECULAR)

        #if LIT_BLEND_TYPE == NORMAL || LIT_BLEND_TYPE == PREMULTIPLIED

            var specLum: f32 = dot((dSpecularLight + dReflection.rgb * dReflection.a), vec3f( 0.2126, 0.7152, 0.0722 ));
            #ifdef LIT_CLEARCOAT
                specLum = specLum + dot(ccSpecularLight * litArgs_clearcoat_specularity + ccReflection * litArgs_clearcoat_specularity, vec3f( 0.2126, 0.7152, 0.0722 ));
            #endif
            litArgs_opacity = clamp(litArgs_opacity + gammaCorrectInput(specLum), 0.0, 1.0);

        #endif

        litArgs_opacity = litArgs_opacity * uniform.material_alphaFade;

    #endif

    // end chunks - when baking lightmap
    #ifdef LIT_LIGHTMAP_BAKING
        #ifdef LIT_LIGHTMAP_BAKING_COLOR
            #include "bakeLmEndPS"
        #endif
        #ifdef LIT_LIGHTMAP_BAKING_DIR
            #include "bakeDirLmEndPS"
        #endif
    #else
        // end chunks - in all other cases
        #include "endPS"
        #include "outputAlphaPS"
    #endif

    #ifdef LIT_MSDF
        output.color = applyMsdf(output.color);
    #endif

    #include "outputPS"
    #include "debugOutputPS"

    #ifdef LIT_SHADOW_CATCHER
        // output when the shadow catcher is enabled - accumulated shadows
        output.color = vec4f(vec3f(dShadowCatcher), output.color.a);
    #endif

    return output;
}
`;
