// functions used to evaluate the light shadow
export default /* glsl */`

// shadow casting functionality
#ifdef LIGHT{i}CASTSHADOW

    // generate shadow coordinates function, based on per light defines:
    // - _SHADOW_SAMPLE_NORMAL_OFFSET
    // - _SHADOW_SAMPLE_ORTHO
    // - _SHADOW_SAMPLE_POINT
    // - _SHADOW_SAMPLE_SOURCE_ZBUFFER
    vec3 getShadowSampleCoord{i}(mat4 shadowTransform, vec4 shadowParams, vec3 worldPosition, vec3 lightPos, inout vec3 lightDir, vec3 lightDirNorm, vec3 normal) {

        vec3 surfacePosition = worldPosition;

        #ifdef LIGHT{i}_SHADOW_SAMPLE_POINT
            #ifdef LIGHT{i}_SHADOW_SAMPLE_NORMAL_OFFSET
                float distScale = length(lightDir);
                surfacePosition = surfacePosition + normal * shadowParams.y * clamp(1.0 - dot(normal, -lightDirNorm), 0.0, 1.0) * distScale;
                lightDir = surfacePosition - lightPos;
                return lightDir;
            #endif
        #else
            #ifdef LIGHT{i}_SHADOW_SAMPLE_SOURCE_ZBUFFER
                #ifdef LIGHT{i}_SHADOW_SAMPLE_NORMAL_OFFSET
                    surfacePosition = surfacePosition + normal * shadowParams.y;
                #endif
            #else
                #ifdef LIGHT{i}_SHADOW_SAMPLE_NORMAL_OFFSET
                    #ifdef LIGHT{i}_SHADOW_SAMPLE_ORTHO
                        float distScale = 1.0;
                    #else
                        float distScale = abs(dot(vPositionW - lightPos, lightDirNorm));
                    #endif
                    surfacePosition = surfacePosition + normal * shadowParams.y * clamp(1.0 - dot(normal, -lightDirNorm), 0.0, 1.0) * distScale;
                #endif
            #endif

            vec4 positionInShadowSpace = shadowTransform * vec4(surfacePosition, 1.0);
            #ifdef LIGHT{i}_SHADOW_SAMPLE_ORTHO
                positionInShadowSpace.z = saturate(positionInShadowSpace.z) - 0.0001;
            #else
                #ifdef LIGHT{i}_SHADOW_SAMPLE_SOURCE_ZBUFFER
                    positionInShadowSpace.xyz /= positionInShadowSpace.w;
                #else
                    positionInShadowSpace.xy /= positionInShadowSpace.w;
                    positionInShadowSpace.z = length(lightDir) * shadowParams.w;
                #endif
            #endif

            // this is currently unused
            #ifdef SHADOW_SAMPLE_Z_BIAS
                // positionInShadowSpace.z += getShadowBias(shadowParams.x, shadowParams.z);
            #endif
            surfacePosition = positionInShadowSpace.xyz;
        #endif

        return surfacePosition;
    }

    // shadow evaluation function
    float getShadow{i}(vec3 lightDirW) {

        // directional shadow cascades
        #ifdef LIGHT{i}_SHADOW_CASCADES

            // select shadow cascade matrix
            int cascadeIndex = getShadowCascadeIndex(light{i}_shadowCascadeDistances, light{i}_shadowCascadeCount);

            #ifdef LIGHT{i}_SHADOW_CASCADE_BLEND
                cascadeIndex = ditherShadowCascadeIndex(cascadeIndex, light{i}_shadowCascadeDistances, light{i}_shadowCascadeCount, light{i}_shadowCascadeBlend);
            #endif

            mat4 shadowMatrix = light{i}_shadowMatrixPalette[cascadeIndex];

        #else

            mat4 shadowMatrix = light{i}_shadowMatrix;

        #endif

        #if LIGHT{i}TYPE == DIRECTIONAL
            // directional light does not have a position
            vec3 shadowCoord = getShadowSampleCoord{i}(shadowMatrix, light{i}_shadowParams, vPositionW, vec3(0.0), lightDirW, dLightDirNormW, dVertexNormalW);
        #else
            vec3 shadowCoord = getShadowSampleCoord{i}(shadowMatrix, light{i}_shadowParams, vPositionW, light{i}_position, lightDirW, dLightDirNormW, dVertexNormalW);
        #endif

        // Fade directional shadow at the far distance
        #if LIGHT{i}TYPE == DIRECTIONAL
            shadowCoord = fadeShadow(shadowCoord, light{i}_shadowCascadeDistances);
        #endif

        // ----- sample the shadow -----

        #if LIGHT{i}TYPE == DIRECTIONAL // ----- directional light -----

            #if LIGHT{i}SHADOWTYPE == VSM_16F
                return getShadowVSM16(SHADOWMAP_PASS(light{i}_shadowMap), shadowCoord, light{i}_shadowParams, 5.54);
            #endif

            #if LIGHT{i}SHADOWTYPE == VSM_32F
                return getShadowVSM32(SHADOWMAP_PASS(light{i}_shadowMap), shadowCoord, light{i}_shadowParams, 15.0);
            #endif

            #if LIGHT{i}SHADOWTYPE == PCSS_32F

                #if LIGHT{i}SHAPE != PUNCTUAL
                    vec2 shadowSearchArea = vec2(length(light{i}_halfWidth), length(light{i}_halfHeight)) * light{i}_shadowSearchArea;
                    return getShadowPCSS(SHADOWMAP_PASS(light{i}_shadowMap), shadowCoord, light{i}_shadowParams, light{i}_cameraParams, shadowSearchArea, lightDirW);
                #else
                    return getShadowPCSS(SHADOWMAP_PASS(light{i}_shadowMap), shadowCoord, light{i}_shadowParams, light{i}_cameraParams, light{i}_softShadowParams, lightDirW);
                #endif

            #endif

            #if LIGHT{i}SHADOWTYPE == PCF1_16F || LIGHT{i}SHADOWTYPE == PCF1_32F
                return getShadowPCF1x1(SHADOWMAP_PASS(light{i}_shadowMap), shadowCoord, light{i}_shadowParams);
            #endif

            #if LIGHT{i}SHADOWTYPE == PCF3_16F || LIGHT{i}SHADOWTYPE == PCF3_32F
                return getShadowPCF3x3(SHADOWMAP_PASS(light{i}_shadowMap), shadowCoord, light{i}_shadowParams);
            #endif

            #if LIGHT{i}SHADOWTYPE == PCF5_16F || LIGHT{i}SHADOWTYPE == PCF5_32F
                return getShadowPCF5x5(SHADOWMAP_PASS(light{i}_shadowMap), shadowCoord, light{i}_shadowParams);
            #endif

        #endif


        #if LIGHT{i}TYPE == SPOT // ----- spot light -----

            #if LIGHT{i}SHADOWTYPE == VSM_16F
                return getShadowSpotVSM16(SHADOWMAP_PASS(light{i}_shadowMap), shadowCoord, light{i}_shadowParams, 5.54, lightDirW);
            #endif

            #if LIGHT{i}SHADOWTYPE == VSM_32F
                return getShadowSpotVSM32(SHADOWMAP_PASS(light{i}_shadowMap), shadowCoord, light{i}_shadowParams, 15.0, lightDirW);
            #endif

            #if LIGHT{i}SHADOWTYPE == PCSS_32F

                #if LIGHT{i}SHAPE != PUNCTUAL
                    vec2 shadowSearchArea = vec2(length(light{i}_halfWidth), length(light{i}_halfHeight)) * light{i}_shadowSearchArea;
                #else
                    vec2 shadowSearchArea = vec2(light{i}_shadowSearchArea);
                #endif

                return getShadowSpotPCSS(SHADOWMAP_PASS(light{i}_shadowMap), shadowCoord, light{i}_shadowParams, light{i}_cameraParams, shadowSearchArea, lightDirW);

            #endif

            #if LIGHT{i}SHADOWTYPE == PCF1_16F || LIGHT{i}SHADOWTYPE == PCF1_32F
                return getShadowSpotPCF1x1(SHADOWMAP_PASS(light{i}_shadowMap), shadowCoord, light{i}_shadowParams);
            #endif

            #if LIGHT{i}SHADOWTYPE == PCF3_16F || LIGHT{i}SHADOWTYPE == PCF3_32F
                return getShadowSpotPCF3x3(SHADOWMAP_PASS(light{i}_shadowMap), shadowCoord, light{i}_shadowParams);
            #endif

            #if LIGHT{i}SHADOWTYPE == PCF5_16F || LIGHT{i}SHADOWTYPE == PCF5_32F
                return getShadowSpotPCF5x5(SHADOWMAP_PASS(light{i}_shadowMap), shadowCoord, light{i}_shadowParams);
            #endif

        #endif


        #if LIGHT{i}TYPE == OMNI // ----- omni light -----

            #if LIGHT{i}SHADOWTYPE == PCSS_32F

                #if LIGHT{i}SHAPE != PUNCTUAL
                    vec2 shadowSearchArea = vec2(length(light{i}_halfWidth), length(light{i}_halfHeight)) * light{i}_shadowSearchArea;
                #else
                    vec2 shadowSearchArea = vec2(light{i}_shadowSearchArea);
                #endif

                return getShadowOmniPCSS(SHADOWMAP_PASS(light{i}_shadowMap), shadowCoord, light{i}_shadowParams, light{i}_cameraParams, shadowSearchArea, lightDirW);

            #endif

            #if LIGHT{i}SHADOWTYPE == PCF1_16F || LIGHT{i}SHADOWTYPE == PCF1_32F
                return getShadowOmniPCF1x1(SHADOWMAP_PASS(light{i}_shadowMap), shadowCoord, light{i}_shadowParams, lightDirW);
            #endif

            #if LIGHT{i}SHADOWTYPE == PCF3_16F || LIGHT{i}SHADOWTYPE == PCF3_32F
                return getShadowOmniPCF3x3(SHADOWMAP_PASS(light{i}_shadowMap), shadowCoord, light{i}_shadowParams, lightDirW);
            #endif

        #endif
    }
#endif
`;
