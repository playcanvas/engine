// evaluation of a light with index {i}, driven by defines
export default /* glsl */`
#if defined(LIGHT{i})

    // evaluate area light values
    #if LIGHT{i}SHAPE != PUNCTUAL
        #if LIGHT{i}SHAPE == RECT
            calcRectLightValues(light{i}_position, light{i}_halfWidth, light{i}_halfHeight);
        #elif LIGHT{i}SHAPE == DISK
            calcDiskLightValues(light{i}_position, light{i}_halfWidth, light{i}_halfHeight);
        #elif LIGHT{i}SHAPE == SPHERE
            calcSphereLightValues(light{i}_position, light{i}_halfWidth, light{i}_halfHeight);
        #endif
    #endif

    #if LIGHT{i}TYPE == DIRECTIONAL // directional light

        dLightDirNormW = light{i}_direction;
        dAtten = 1.0;

    #else // omni or spot light
        
        getLightDirPoint(light{i}_position);

        // cookie attenuation
        #if defined(LIGHT{i}COOKIE)

            #if LIGHT{i}TYPE == SPOT
                #ifdef LIGHT{i}COOKIE_FALLOFF
                    #ifdef LIGHT{i}COOKIE_TRANSFORM
                        dAtten3 = getCookie2DXform(light{i}_cookie, light{i}_shadowMatrix, light{i}_cookieIntensity, light{i}_cookieMatrix, light{i}_cookieOffset).{LIGHT{i}COOKIE_CHANNEL};
                    #else
                        dAtten3 = getCookie2D(light{i}_cookie, light{i}_shadowMatrix, light{i}_cookieIntensity).{LIGHT{i}COOKIE_CHANNEL};
                    #endif
                #else
                    #ifdef LIGHT{i}COOKIE_TRANSFORM
                        dAtten3 = getCookie2DClipXform(light{i}_cookie, light{i}_shadowMatrix, light{i}_cookieIntensity, light{i}_cookieMatrix, light{i}_cookieOffset).{LIGHT{i}COOKIE_CHANNEL};
                    #else
                        dAtten3 = getCookie2DClip(light{i}_cookie, light{i}_shadowMatrix, light{i}_cookieIntensity).{LIGHT{i}COOKIE_CHANNEL};
                    #endif
                #endif
            #endif

            #if LIGHT{i}TYPE == OMNI
                dAtten3 = getCookieCube(light{i}_cookie, light{i}_shadowMatrix, light{i}_cookieIntensity).{LIGHT{i}COOKIE_CHANNEL};
            #endif
        #endif

        // distance falloff
        #if LIGHT{i}SHAPE == PUNCTUAL
            #if LIGHT{i}FALLOFF == LINEAR
                dAtten = getFalloffLinear(light{i}_radius, dLightDirW);
            #else
                dAtten = getFalloffInvSquared(light{i}_radius, dLightDirW);
            #endif
        #else
            // non punctual lights only gets the range window here
            dAtten = getFalloffWindow(light{i}_radius, dLightDirW);
        #endif

        if (dAtten > 0.00001) { // OPEN BRACKET

            // spot light angle falloff
            #if LIGHT{i}TYPE == SPOT
                #if !defined(LIGHT{i}COOKIE) || defined(LIGHT{i}COOKIE_FALLOFF)
                    dAtten *= getSpotEffect(light{i}_direction, light{i}_innerConeAngle, light{i}_outerConeAngle, dLightDirNormW);
                #endif
            #endif
    #endif

    // diffuse lighting - LTC lights do not mix diffuse lighting into attenuation that affects specular
    #if LIGHT{i}SHAPE != PUNCTUAL
        #if LIGHT{i}TYPE == DIRECTIONAL
            // NB: A better aproximation perhaps using wrap lighting could be implemented here
            dAttenD = getLightDiffuse(litArgs_worldNormal, dViewDirW, dLightDirW, dLightDirNormW);
        #else
            // 16.0 is a constant that is in getFalloffInvSquared()
            #if LIGHT{i}SHAPE == RECT
                dAttenD = getRectLightDiffuse(litArgs_worldNormal, dViewDirW, dLightDirW, dLightDirNormW) * 16.0;
            #elif LIGHT{i}SHAPE == DISK
                dAttenD = getDiskLightDiffuse(litArgs_worldNormal, dViewDirW, dLightDirW, dLightDirNormW) * 16.0;
            #elif LIGHT{i}SHAPE == SPHERE
                dAttenD = getSphereLightDiffuse(litArgs_worldNormal, dViewDirW, dLightDirW, dLightDirNormW) * 16.0;
            #endif
        #endif
    #else
        dAtten *= getLightDiffuse(litArgs_worldNormal, dViewDirW, dLightDirW, dLightDirNormW);
    #endif
    
    // apply the shadow attenuation
    #ifdef LIGHT{i}CASTSHADOW

        float shadow{i} = getShadow{i}();
        dAtten *= mix(1.0, shadow{i}, light{i}_shadowIntensity);

    #endif

    // light color
    vec3 light{i}_colorAndCookie = light{i}_color;

    // multiply in the cookie color
    #if defined(LIGHT{i}COOKIE)
        light{i}_colorAndCookie *= dAtten3;
    #endif

    #if LIGHT{i}SHAPE != PUNCTUAL
        // area light - they do not mix diffuse lighting into specular attenuation
        #ifdef LIT_SPECULAR
            dDiffuseLight += ((dAttenD * dAtten) * light{i}_colorAndCookie) * (1.0 - dLTCSpecFres);
        #else
            dDiffuseLight += (dAttenD * dAtten) * light{i}_colorAndCookie;
        #endif                        
    #else
        // punctual light
        #if defined(AREA_LIGHTS) && defined(LIT_SPECULAR)
            dDiffuseLight += (dAtten * light{i}_colorAndCookie) * (1.0 - litArgs_specularity);
        #else
            dDiffuseLight += dAtten * light{i}_colorAndCookie;
        #endif
    #endif

    #ifdef LIT_SPECULAR
        dHalfDirW = normalize(-dLightDirNormW + dViewDirW);
    #endif

    // specular lighting
    #ifdef LIGHT{i}AFFECT_SPECULARITY

        #if LIGHT{i}SHAPE != PUNCTUAL // area light

            #ifdef LIT_CLEARCOAT
                #if LIGHT{i}SHAPE == RECT
                    ccSpecularLight += ccLTCSpecFres * getRectLightSpecular(litArgs_clearcoat_worldNormal, dViewDirW) * dAtten * light{i}_colorAndCookie;
                #elif LIGHT{i}SHAPE == DISK
                    ccSpecularLight += ccLTCSpecFres * getDiskLightSpecular(litArgs_clearcoat_worldNormal, dViewDirW) * dAtten * light{i}_colorAndCookie;
                #elif LIGHT{i}SHAPE == SPHERE
                    ccSpecularLight += ccLTCSpecFres * getSphereLightSpecular(litArgs_clearcoat_worldNormal, dViewDirW) * dAtten * light{i}_colorAndCookie;
                #endif
            #endif

            #ifdef LIT_SPECULAR
                #if LIGHT{i}SHAPE == RECT
                    dSpecularLight += dLTCSpecFres * getRectLightSpecular(litArgs_worldNormal, dViewDirW) * dAtten * light{i}_colorAndCookie;
                #elif LIGHT{i}SHAPE == DISK
                    dSpecularLight += dLTCSpecFres * getDiskLightSpecular(litArgs_worldNormal, dViewDirW) * dAtten * light{i}_colorAndCookie;
                #elif LIGHT{i}SHAPE == SPHERE
                    dSpecularLight += dLTCSpecFres * getSphereLightSpecular(litArgs_worldNormal, dViewDirW) * dAtten * light{i}_colorAndCookie;
                #endif
            #endif

        #else // punctual light

            // is fresnel needed
            #if LIGHT{i}TYPE == DIRECTIONAL && LIT_FRESNEL_MODEL != NONE
                #define LIGHT{i}FRESNEL
            #endif

            // if LTC lights are present, specular must be accumulated with specularity (specularity is pre multiplied by punctual light fresnel)
            #ifdef LIT_CLEARCOAT
                vec3 light{i}specularCC = getLightSpecular(dHalfDirW, ccReflDirW, litArgs_clearcoat_worldNormal, dViewDirW, dLightDirNormW, litArgs_clearcoat_gloss, dTBN) * dAtten * light{i}_colorAndCookie;
                #ifdef LIGHT{i}FRESNEL
                    light{i}specularCC *= getFresnelCC(dot(dViewDirW, dHalfDirW));
                #endif
                ccSpecularLight += light{i}specularCC;
            #endif

            #ifdef LIT_SHEEN
                sSpecularLight += getLightSpecularSheen(dHalfDirW, litArgs_worldNormal, dViewDirW, dLightDirNormW, litArgs_sheen_gloss) * dAtten * light{i}_colorAndCookie;
            #endif

            #ifdef LIT_SPECULAR

                vec3 light{i}specular = getLightSpecular(dHalfDirW, dReflDirW, litArgs_worldNormal, dViewDirW, dLightDirNormW, litArgs_gloss, dTBN) * dAtten * light{i}_colorAndCookie;
                #ifdef LIGHT{i}FRESNEL

                    #if defined(LIT_IRIDESCENCE)
                        light{i}specular *= getFresnel(dot(dViewDirW, dHalfDirW), litArgs_gloss, litArgs_specularity, iridescenceFresnel, litArgs_iridescence_intensity);
                    #else
                        light{i}specular *= getFresnel(dot(dViewDirW, dHalfDirW), litArgs_gloss, litArgs_specularity);
                    #endif

                #else
                    light{i}specular *= litArgs_specularity;
                #endif
                
                dSpecularLight += light{i}specular;
            #endif
        #endif
    #endif

    #if LIGHT{i}TYPE != DIRECTIONAL
        } // CLOSE BRACKET
    #endif

#endif
`;
