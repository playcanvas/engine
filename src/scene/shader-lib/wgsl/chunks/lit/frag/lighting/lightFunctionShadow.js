// functions used to evaluate the light shadow
export default /* wgsl */`

// shadow casting functionality
#ifdef LIGHT{i}CASTSHADOW

    // Omni shadow coordinate function - uses light direction for cubemap sampling
    #ifdef LIGHT{i}_SHADOW_SAMPLE_POINT
        fn getShadowSampleCoordOmni{i}(shadowParams: vec4f, worldPosition: vec3f, lightPos: vec3f, lightDir: ptr<function, vec3f>, lightDirNorm: vec3f, normal: vec3f) -> vec3f {
            #ifdef LIGHT{i}_SHADOW_SAMPLE_NORMAL_OFFSET
                let distScale: f32 = length(*lightDir);
                var surfacePosition = worldPosition + normal * shadowParams.y * clamp(1.0 - dot(normal, -lightDirNorm), 0.0, 1.0) * distScale;
                *lightDir = surfacePosition - lightPos;
            #endif
            return *lightDir;
        }
    #endif

    // Directional/Spot shadow coordinate function - uses shadow matrix transformation
    #ifndef LIGHT{i}_SHADOW_SAMPLE_POINT
        fn getShadowSampleCoord{i}(shadowTransform: mat4x4f, shadowParams: vec4f, worldPosition: vec3f, lightPos: vec3f, lightDir: ptr<function, vec3f>, lightDirNorm: vec3f, normal: vec3f) -> vec3f {

            var surfacePosition = worldPosition;

            #ifdef LIGHT{i}_SHADOW_SAMPLE_SOURCE_ZBUFFER
                #ifdef LIGHT{i}_SHADOW_SAMPLE_NORMAL_OFFSET
                    surfacePosition = surfacePosition + normal * shadowParams.y;
                #endif
            #else
                #ifdef LIGHT{i}_SHADOW_SAMPLE_NORMAL_OFFSET
                    #ifdef LIGHT{i}_SHADOW_SAMPLE_ORTHO
                        var distScale: f32 = 1.0;
                    #else
                        var distScale: f32 = abs(dot(vPositionW - lightPos, lightDirNorm));
                    #endif
                    surfacePosition = surfacePosition + normal * shadowParams.y * clamp(1.0 - dot(normal, -lightDirNorm), 0.0, 1.0) * distScale;
                #endif
            #endif

            var positionInShadowSpace: vec4f = shadowTransform * vec4f(surfacePosition, 1.0);
            #ifdef LIGHT{i}_SHADOW_SAMPLE_ORTHO
                positionInShadowSpace.z = saturate(positionInShadowSpace.z) - 0.0001;
            #else
                #ifdef LIGHT{i}_SHADOW_SAMPLE_SOURCE_ZBUFFER
                    positionInShadowSpace.xyz = positionInShadowSpace.xyz / positionInShadowSpace.w;
                #else
                    positionInShadowSpace.xy = positionInShadowSpace.xy / positionInShadowSpace.w;
                    positionInShadowSpace.z = length(*lightDir) * shadowParams.w;
                #endif
            #endif

            return positionInShadowSpace.xyz;
        }
    #endif

    // shadow evaluation function
    fn getShadow{i}(lightDirW_in: vec3f) -> f32 {

        var lightDirArg = lightDirW_in;

        #if LIGHT{i}TYPE == OMNI

            // omni shadows use cubemap and sample by direction
            var shadowCoord: vec3f = getShadowSampleCoordOmni{i}(uniform.light{i}_shadowParams, vPositionW, uniform.light{i}_position, &lightDirArg, dLightDirNormW, dVertexNormalW);

        #else

            // directional and spot shadows use shadow matrix transformation
            #ifdef LIGHT{i}_SHADOW_CASCADES
                var cascadeIndex: i32 = getShadowCascadeIndex(uniform.light{i}_shadowCascadeDistances, uniform.light{i}_shadowCascadeCount);
                #ifdef LIGHT{i}_SHADOW_CASCADE_BLEND
                    cascadeIndex = ditherShadowCascadeIndex(cascadeIndex, uniform.light{i}_shadowCascadeDistances, uniform.light{i}_shadowCascadeCount, uniform.light{i}_shadowCascadeBlend);
                #endif
                var shadowMatrix: mat4x4f = uniform.light{i}_shadowMatrixPalette[cascadeIndex];
            #else
                var shadowMatrix: mat4x4f = uniform.light{i}_shadowMatrix;
            #endif

            #if LIGHT{i}TYPE == DIRECTIONAL
                var shadowCoord: vec3f = getShadowSampleCoord{i}(shadowMatrix, uniform.light{i}_shadowParams, vPositionW, vec3f(0.0), &lightDirArg, dLightDirNormW, dVertexNormalW);
            #else
                var shadowCoord: vec3f = getShadowSampleCoord{i}(shadowMatrix, uniform.light{i}_shadowParams, vPositionW, uniform.light{i}_position, &lightDirArg, dLightDirNormW, dVertexNormalW);
            #endif

        #endif


        // Fade directional shadow at the far distance
        #if LIGHT{i}TYPE == DIRECTIONAL
            shadowCoord = fadeShadow(shadowCoord, uniform.light{i}_shadowCascadeDistances);
        #endif

        // ----- sample the shadow -----

        #if LIGHT{i}TYPE == DIRECTIONAL // ----- directional light -----

            #if LIGHT{i}SHADOWTYPE == VSM_16F
                return getShadowVSM16(light{i}_shadowMap, light{i}_shadowMapSampler, shadowCoord, uniform.light{i}_shadowParams, 5.54);
            #endif

            #if LIGHT{i}SHADOWTYPE == VSM_32F
                return getShadowVSM32(light{i}_shadowMap, light{i}_shadowMapSampler, shadowCoord, uniform.light{i}_shadowParams, 15.0);
            #endif

            #if LIGHT{i}SHADOWTYPE == PCSS_32F

                #if LIGHT{i}SHAPE != PUNCTUAL
                    let shadowSearchArea = vec2f(length(uniform.light{i}_halfWidth), length(uniform.light{i}_halfHeight)) * uniform.light{i}_shadowSearchArea;
                    return getShadowPCSS(light{i}_shadowMap, light{i}_shadowMapSampler, shadowCoord, uniform.light{i}_shadowParams, uniform.light{i}_cameraParams, shadowSearchArea, lightDirW_in);
                #else
                    return getShadowPCSS(light{i}_shadowMap, light{i}_shadowMapSampler, shadowCoord, uniform.light{i}_shadowParams, uniform.light{i}_cameraParams, uniform.light{i}_softShadowParams, lightDirW_in);
                #endif

            #endif

            #if LIGHT{i}SHADOWTYPE == PCF1_16F || LIGHT{i}SHADOWTYPE == PCF1_32F
                return getShadowPCF1x1(light{i}_shadowMap, light{i}_shadowMapSampler, shadowCoord, uniform.light{i}_shadowParams);
            #endif

            #if LIGHT{i}SHADOWTYPE == PCF3_16F || LIGHT{i}SHADOWTYPE == PCF3_32F
                return getShadowPCF3x3(light{i}_shadowMap, light{i}_shadowMapSampler, shadowCoord, uniform.light{i}_shadowParams);
            #endif

            #if LIGHT{i}SHADOWTYPE == PCF5_16F || LIGHT{i}SHADOWTYPE == PCF5_32F
                return getShadowPCF5x5(light{i}_shadowMap, light{i}_shadowMapSampler, shadowCoord, uniform.light{i}_shadowParams);
            #endif

        #endif


        #if LIGHT{i}TYPE == SPOT // ----- spot light -----

            #if LIGHT{i}SHADOWTYPE == VSM_16F
                return getShadowSpotVSM16(light{i}_shadowMap, light{i}_shadowMapSampler, shadowCoord, uniform.light{i}_shadowParams, 5.54, lightDirW_in);
            #endif

            #if LIGHT{i}SHADOWTYPE == VSM_32F
                return getShadowSpotVSM32(light{i}_shadowMap, light{i}_shadowMapSampler, shadowCoord, uniform.light{i}_shadowParams, 15.0, lightDirW_in);
            #endif

            #if LIGHT{i}SHADOWTYPE == PCSS_32F

                #if LIGHT{i}SHAPE != PUNCTUAL
                    var shadowSearchArea: vec2f = vec2f(length(uniform.light{i}_halfWidth), length(uniform.light{i}_halfHeight)) * uniform.light{i}_shadowSearchArea;
                #else
                    var shadowSearchArea: vec2f = vec2f(uniform.light{i}_shadowSearchArea);
                #endif
                return getShadowSpotPCSS(light{i}_shadowMap, light{i}_shadowMapSampler, shadowCoord, uniform.light{i}_shadowParams, uniform.light{i}_cameraParams, shadowSearchArea, lightDirW_in);

            #endif

            #if LIGHT{i}SHADOWTYPE == PCF1_16F || LIGHT{i}SHADOWTYPE == PCF1_32F
                return getShadowSpotPCF1x1(light{i}_shadowMap, light{i}_shadowMapSampler, shadowCoord, uniform.light{i}_shadowParams);
            #endif

            #if LIGHT{i}SHADOWTYPE == PCF3_16F || LIGHT{i}SHADOWTYPE == PCF3_32F
                return getShadowSpotPCF3x3(light{i}_shadowMap, light{i}_shadowMapSampler, shadowCoord, uniform.light{i}_shadowParams);
            #endif

            #if LIGHT{i}SHADOWTYPE == PCF5_16F || LIGHT{i}SHADOWTYPE == PCF5_32F
                return getShadowSpotPCF5x5(light{i}_shadowMap, light{i}_shadowMapSampler, shadowCoord, uniform.light{i}_shadowParams);
            #endif

        #endif


        #if LIGHT{i}TYPE == OMNI // ----- omni light -----

            #if LIGHT{i}SHADOWTYPE == PCSS_32F

                 var shadowSearchArea: vec2f; // Use var because assigned in if/else
                 #if LIGHT{i}SHAPE != PUNCTUAL
                    var shadowSearchArea: vec2f = vec2f(length(uniform.light{i}_halfWidth), length(uniform.light{i}_halfHeight)) * uniform.light{i}_shadowSearchArea;
                #else
                    var shadowSearchArea: vec2f = vec2f(uniform.light{i}_shadowSearchArea);
                #endif

                return getShadowOmniPCSS(light{i}_shadowMap, light{i}_shadowMapSampler, shadowCoord, uniform.light{i}_shadowParams, uniform.light{i}_cameraParams, shadowSearchArea, lightDirW_in);

            #endif

            #if LIGHT{i}SHADOWTYPE == PCF1_16F || LIGHT{i}SHADOWTYPE == PCF1_32F
                return getShadowOmniPCF1x1(light{i}_shadowMap, light{i}_shadowMapSampler, shadowCoord, uniform.light{i}_shadowParams, lightDirW_in);
            #endif

            #if LIGHT{i}SHADOWTYPE == PCF3_16F || LIGHT{i}SHADOWTYPE == PCF3_32F
                return getShadowOmniPCF3x3(light{i}_shadowMap, light{i}_shadowMapSampler, shadowCoord, uniform.light{i}_shadowParams, lightDirW_in);
            #endif

        #endif
    }

#endif
`;
