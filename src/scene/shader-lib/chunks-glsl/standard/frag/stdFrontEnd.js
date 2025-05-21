// includes and functionality of the front end shader, generates the input to the lit shader.
export default /* glsl */`

    // all passes handle opacity
    #if LIT_BLEND_TYPE != NONE || defined(LIT_ALPHA_TEST) || defined(LIT_ALPHA_TO_COVERAGE) || STD_OPACITY_DITHER != NONE
        #ifdef STD_OPACITY_TEXTURE_ALLOCATE
            uniform sampler2D texture_opacityMap;
        #endif
        #include "opacityPS"
    #endif

    #ifdef FORWARD_PASS // ----------------

        // parallax
        #ifdef STD_HEIGHT_MAP
            #include "parallaxPS"
        #endif

        // diffuse
        #include  "diffusePS"

        // normal
        #ifdef LIT_NEEDS_NORMAL
            #include "normalMapPS"
        #endif

        // refraction
        #ifdef LIT_REFRACTION
            #include "transmissionPS"
            #include "thicknessPS"
        #endif

        // iridescence
        #ifdef LIT_IRIDESCENCE
            #include "iridescencePS"
            #include "iridescenceThicknessPS"
        #endif

        // specularity & glossiness
        #ifdef LIT_SPECULAR_OR_REFLECTION

            // sheen
            #ifdef LIT_SHEEN
                #include "sheenPS"
                #include "sheenGlossPS"
            #endif

            // metalness
            #ifdef LIT_METALNESS
                #include "metalnessPS"
                #include "iorPS"
            #endif

            // specularity factor
            #ifdef LIT_SPECULARITY_FACTOR
                #include "specularityFactorPS"
            #endif

            // specular color
            #ifdef STD_SPECULAR_COLOR
                #include "specularPS"
            #else
                void getSpecularity() { 
                    dSpecularity = vec3(1);
                }
            #endif

            // gloss
            #include "glossPS"
        #endif

        // ao
        #ifdef STD_AO
            #include "aoPS"
        #endif

        // emission
        #include "emissivePS"

        // clearcoat
        #ifdef LIT_CLEARCOAT
            #include "clearCoatPS"
            #include "clearCoatGlossPS"
            #include "clearCoatNormalPS"
        #endif

        // anisotropy
        #if defined(LIT_SPECULAR) && defined(LIT_LIGHTING) && defined(LIT_GGX_SPECULAR)
            #include "anisotropyPS"
        #endif

        // lightmap
        #if defined(STD_LIGHTMAP) || defined(STD_LIGHT_VERTEX_COLOR)
            #include "lightmapPS"
        #endif
    #endif

    void evaluateFrontend() {

        // all passes handle opacity
        #if LIT_BLEND_TYPE != NONE || defined(LIT_ALPHA_TEST) || defined(LIT_ALPHA_TO_COVERAGE) || STD_OPACITY_DITHER != NONE
            getOpacity();

            #if defined(LIT_ALPHA_TEST)
                alphaTest(dAlpha);
            #endif

            #if STD_OPACITY_DITHER != NONE
                opacityDither(dAlpha, 0.0);
            #endif

            litArgs_opacity = dAlpha;
        #endif

        #ifdef FORWARD_PASS // ----------------

            // parallax
            #ifdef STD_HEIGHT_MAP
                getParallax();
            #endif

            // diffuse
            getAlbedo();
            litArgs_albedo = dAlbedo;

            // normal
            #ifdef LIT_NEEDS_NORMAL
                getNormal();
                litArgs_worldNormal = dNormalW;
            #endif

            // refraction
            #ifdef LIT_REFRACTION
                getRefraction();
                litArgs_transmission = dTransmission;

                getThickness();
                litArgs_thickness = dThickness;

                #ifdef LIT_DISPERSION
                    litArgs_dispersion = material_dispersion;
                #endif
            #endif

            // iridescence
            #ifdef LIT_IRIDESCENCE
                getIridescence();
                getIridescenceThickness();
                litArgs_iridescence_intensity = dIridescence;
                litArgs_iridescence_thickness = dIridescenceThickness;
            #endif

            // specularity & glossiness
            #ifdef LIT_SPECULAR_OR_REFLECTION

                // sheen
                #ifdef LIT_SHEEN
                    getSheen();
                    litArgs_sheen_specularity = sSpecularity;
                    getSheenGlossiness();
                    litArgs_sheen_gloss = sGlossiness;
                #endif

                // metalness
                #ifdef LIT_METALNESS
                    getMetalness();
                    litArgs_metalness = dMetalness;
                    getIor();
                    litArgs_ior = dIor;
                #endif

                // specularity factor
                #ifdef LIT_SPECULARITY_FACTOR
                    getSpecularityFactor();
                    litArgs_specularityFactor = dSpecularityFactor;
                #endif

                // gloss
                getGlossiness();
                getSpecularity();
                litArgs_specularity = dSpecularity;
                litArgs_gloss = dGlossiness;
            #endif

            // ao
            #ifdef STD_AO
                getAO();
                litArgs_ao = dAo;
            #endif

            // emission
            getEmission();
            litArgs_emission = dEmission;

            // clearcoat
            #ifdef LIT_CLEARCOAT
                getClearCoat();
                getClearCoatGlossiness();
                getClearCoatNormal();
                litArgs_clearcoat_specularity = ccSpecularity;
                litArgs_clearcoat_gloss = ccGlossiness;
                litArgs_clearcoat_worldNormal = ccNormalW;
            #endif

            // anisotropy
            #if defined(LIT_SPECULAR) && defined(LIT_LIGHTING) && defined(LIT_GGX_SPECULAR)
                getAnisotropy();
            #endif

            // lightmap
            #if defined(STD_LIGHTMAP) || defined(STD_LIGHT_VERTEX_COLOR)
                getLightMap();
                litArgs_lightmap = dLightmap;

                #ifdef STD_LIGHTMAP_DIR
                    litArgs_lightmapDir = dLightmapDir;
                #endif
            #endif
        #endif
    }
`;
