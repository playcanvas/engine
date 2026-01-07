// functions used to evaluate the light shadow
export default /* glsl */`

// shadow casting functionality
#ifdef LIGHT{i}CASTSHADOW

    // Omni shadow coordinate function - uses light direction for cubemap sampling
    #ifdef LIGHT{i}_SHADOW_SAMPLE_POINT
        vec3 getShadowSampleCoordOmni{i}(vec4 shadowParams, vec3 worldPosition, vec3 lightPos, inout vec3 lightDir, vec3 lightDirNorm, vec3 normal) {
            #ifdef LIGHT{i}_SHADOW_SAMPLE_NORMAL_OFFSET
                float distScale = length(lightDir);
                vec3 surfacePosition = worldPosition + normal * shadowParams.y * clamp(1.0 - dot(normal, -lightDirNorm), 0.0, 1.0) * distScale;
                lightDir = surfacePosition - lightPos;
            #endif
            return lightDir;
        }
    #endif

    // Directional/Spot shadow coordinate function - uses shadow matrix transformation
    #ifndef LIGHT{i}_SHADOW_SAMPLE_POINT
        vec3 getShadowSampleCoord{i}(mat4 shadowTransform, vec4 shadowParams, vec3 worldPosition, vec3 lightPos, inout vec3 lightDir, vec3 lightDirNorm, vec3 normal) {

            vec3 surfacePosition = worldPosition;

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

            return positionInShadowSpace.xyz;
        }
    #endif

    // shadow evaluation function
    float getShadow{i}(vec3 lightDirW) {

        // directional shadow cascades
        #if LIGHT{i}TYPE == OMNI

            // omni shadows use cubemap and sample by direction
            vec3 shadowCoord = getShadowSampleCoordOmni{i}(light{i}_shadowParams, vPositionW, light{i}_position, lightDirW, dLightDirNormW, dVertexNormalW);

        #else

            // directional and spot shadows use shadow matrix transformation
            #ifdef LIGHT{i}_SHADOW_CASCADES
                int cascadeIndex = getShadowCascadeIndex(light{i}_shadowCascadeDistances, light{i}_shadowCascadeCount);
                #ifdef LIGHT{i}_SHADOW_CASCADE_BLEND
                    cascadeIndex = ditherShadowCascadeIndex(cascadeIndex, light{i}_shadowCascadeDistances, light{i}_shadowCascadeCount, light{i}_shadowCascadeBlend);
                #endif
                mat4 shadowMatrix = light{i}_shadowMatrixPalette[cascadeIndex];
            #else
                mat4 shadowMatrix = light{i}_shadowMatrix;
            #endif

            #if LIGHT{i}TYPE == DIRECTIONAL
                vec3 shadowCoord = getShadowSampleCoord{i}(shadowMatrix, light{i}_shadowParams, vPositionW, vec3(0.0), lightDirW, dLightDirNormW, dVertexNormalW);
            #else
                vec3 shadowCoord = getShadowSampleCoord{i}(shadowMatrix, light{i}_shadowParams, vPositionW, light{i}_position, lightDirW, dLightDirNormW, dVertexNormalW);
            #endif

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
