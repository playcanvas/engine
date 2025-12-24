// Declaration part of the standard shader. Declares the uniforms, textures and global variables used
// by the fragment shader of the standard shader.
export default /* wgsl */`

    // globals
    var<private> dAlpha: f32 = 1.0;

    // all passes handle opacity
    #if LIT_BLEND_TYPE != NONE || defined(LIT_ALPHA_TEST) || defined(LIT_ALPHA_TO_COVERAGE) || STD_OPACITY_DITHER != NONE
        #ifdef STD_OPACITY_TEXTURE_ALLOCATE
            var texture_opacityMap : texture_2d<f32>;
            var texture_opacityMapSampler : sampler;
        #endif
    #endif

    #ifdef FORWARD_PASS // ----------------

        // globals
        var<private> dAlbedo: vec3f;
        var<private> dNormalW: vec3f;
        var<private> dSpecularity: vec3f = vec3f(0.0, 0.0, 0.0);
        var<private> dGlossiness: f32 = 0.0;

        #ifdef LIT_REFRACTION
            var<private> dTransmission: f32;
            var<private> dThickness: f32;
        #endif

        #ifdef LIT_SCENE_COLOR
            var uSceneColorMap : texture_2d<f32>;
            var uSceneColorMapSampler : sampler;
        #endif

        #ifdef LIT_SCREEN_SIZE
            uniform uScreenSize: vec4f;
        #endif

        #ifdef LIT_TRANSFORMS
            var<private> matrix_viewProjection: mat4x4f;
            var<private> matrix_model: mat4x4f;
        #endif

        // parallax
        #ifdef STD_HEIGHT_MAP
            var<private> dUvOffset: vec2f;
            #ifdef STD_HEIGHT_TEXTURE_ALLOCATE
                var texture_heightMap : texture_2d<f32>;
                var texture_heightMapSampler : sampler;
            #endif
        #endif

        // diffuse
        #ifdef STD_DIFFUSE_TEXTURE_ALLOCATE
            var texture_diffuseMap : texture_2d<f32>;
            var texture_diffuseMapSampler : sampler;
        #endif

        #ifdef STD_DIFFUSEDETAIL_TEXTURE_ALLOCATE
            var texture_diffuseDetailMap : texture_2d<f32>;
            var texture_diffuseDetailMapSampler : sampler;
        #endif

        // normal
        #ifdef STD_NORMAL_TEXTURE_ALLOCATE
            var texture_normalMap : texture_2d<f32>;
            var texture_normalMapSampler : sampler;
        #endif

        #ifdef STD_NORMALDETAIL_TEXTURE_ALLOCATE
            var texture_normalDetailMap : texture_2d<f32>;
            var texture_normalDetailMapSampler : sampler;
        #endif

        // refraction
        #ifdef STD_THICKNESS_TEXTURE_ALLOCATE
            var texture_thicknessMap : texture_2d<f32>;
            var texture_thicknessMapSampler : sampler;
        #endif
        #ifdef STD_REFRACTION_TEXTURE_ALLOCATE
            var texture_refractionMap : texture_2d<f32>;
            var texture_refractionMapSampler : sampler;
        #endif

        // iridescence
        #ifdef LIT_IRIDESCENCE
            var<private> dIridescence: f32;
            var<private> dIridescenceThickness: f32;

            #ifdef STD_IRIDESCENCE_THICKNESS_TEXTURE_ALLOCATE
                var texture_iridescenceThicknessMap : texture_2d<f32>;
                var texture_iridescenceThicknessMapSampler : sampler;
            #endif
            #ifdef STD_IRIDESCENCE_TEXTURE_ALLOCATE
                var texture_iridescenceMap : texture_2d<f32>;
                var texture_iridescenceMapSampler : sampler;
            #endif
        #endif

        #ifdef LIT_CLEARCOAT
            var<private> ccSpecularity: f32;
            var<private> ccGlossiness: f32;
            var<private> ccNormalW: vec3f;
        #endif

        #ifdef LIT_GGX_SPECULAR
            var<private> dAnisotropy: f32;
            var<private> dAnisotropyRotation: vec2f;
        #endif

        // specularity & glossiness
        #ifdef LIT_SPECULAR_OR_REFLECTION

            // sheen
            #ifdef LIT_SHEEN
                var<private> sSpecularity: vec3f;
                var<private> sGlossiness: f32;

                #ifdef STD_SHEEN_TEXTURE_ALLOCATE
                    var texture_sheenMap : texture_2d<f32>;
                    var texture_sheenMapSampler : sampler;
                #endif
                #ifdef STD_SHEENGLOSS_TEXTURE_ALLOCATE
                    var texture_sheenGlossMap : texture_2d<f32>;
                    var texture_sheenGlossMapSampler : sampler;
                #endif
            #endif

            // metalness
            #ifdef LIT_METALNESS
                var<private> dMetalness: f32;
                var<private> dIor: f32;

                #ifdef STD_METALNESS_TEXTURE_ALLOCATE
                    var texture_metalnessMap : texture_2d<f32>;
                    var texture_metalnessMapSampler : sampler;
                #endif
            #endif

            // specularity factor
            #ifdef LIT_SPECULARITY_FACTOR
                var<private> dSpecularityFactor: f32;

                #ifdef STD_SPECULARITYFACTOR_TEXTURE_ALLOCATE
                    var texture_specularityFactorMap : texture_2d<f32>;
                    var texture_specularityFactorMapSampler : sampler;
                #endif
            #endif

            // specular color
            #ifdef STD_SPECULAR_COLOR
                #ifdef STD_SPECULAR_TEXTURE_ALLOCATE
                    var texture_specularMap : texture_2d<f32>;
                    var texture_specularMapSampler : sampler;
                #endif
            #endif

            // gloss
            #ifdef STD_GLOSS_TEXTURE_ALLOCATE
                var texture_glossMap : texture_2d<f32>;
                var texture_glossMapSampler : sampler;
            #endif
        #endif

        // ao
        #ifdef STD_AO
            var <private> dAo: f32;
            #ifdef STD_AO_TEXTURE_ALLOCATE
                var texture_aoMap : texture_2d<f32>;
                var texture_aoMapSampler : sampler;
            #endif
            #ifdef STD_AODETAIL_TEXTURE_ALLOCATE
                var texture_aoDetailMap : texture_2d<f32>;
                var texture_aoDetailMapSampler : sampler;
            #endif
        #endif

        // emission
        var <private> dEmission: vec3f;
        #ifdef STD_EMISSIVE_TEXTURE_ALLOCATE
            var texture_emissiveMap : texture_2d<f32>;
            var texture_emissiveMapSampler : sampler;
        #endif

        // clearcoat
        #ifdef LIT_CLEARCOAT
            #ifdef STD_CLEARCOAT_TEXTURE_ALLOCATE
                var texture_clearCoatMap : texture_2d<f32>;
                var texture_clearCoatMapSampler : sampler;
            #endif
            #ifdef STD_CLEARCOATGLOSS_TEXTURE_ALLOCATE
                var texture_clearCoatGlossMap : texture_2d<f32>;
                var texture_clearCoatGlossMapSampler : sampler;
            #endif
            #ifdef STD_CLEARCOATNORMAL_TEXTURE_ALLOCATE
                var texture_clearCoatNormalMap : texture_2d<f32>;
                var texture_clearCoatNormalMapSampler : sampler;
            #endif
        #endif

        // anisotropy
        #ifdef LIT_GGX_SPECULAR
            #ifdef STD_ANISOTROPY_TEXTURE_ALLOCATE
                var texture_anisotropyMap : texture_2d<f32>;
                var texture_anisotropyMapSampler : sampler;
            #endif
        #endif

        // lightmap
        #if defined(STD_LIGHTMAP) || defined(STD_LIGHT_VERTEX_COLOR)
            var<private> dLightmap: vec3f;
            #ifdef STD_LIGHT_TEXTURE_ALLOCATE
                var texture_lightMap : texture_2d<f32>;
                var texture_lightMapSampler : sampler;
            #endif
        #endif
    #endif

    // front end outputs to lit shader
    #include "litShaderCorePS"
`;
