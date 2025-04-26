// functions used to evaluate the light
export default /* glsl */`
#if defined(LIGHT{i})

void evaluateLight{i}(
    #if defined(LIT_IRIDESCENCE)
        vec3 iridescenceFresnel
    #endif
) {

    // light color
    vec3 lightColor = light{i}_color;

    #if LIGHT{i}TYPE == DIRECTIONAL && !defined(LIT_SHADOW_CATCHER)
        // early return if the light color is black (used by shadow catcher - this way this light is very cheap)
        if (all(equal(lightColor, vec3(0.0)))) {
            return;
        }
    #endif

    #if LIGHT{i}TYPE == DIRECTIONAL // directional light

        dLightDirNormW = light{i}_direction;
        dAtten = 1.0;

    #else // omni or spot light
        
        vec3 lightDirW = evalOmniLight(light{i}_position);
        dLightDirNormW = normalize(lightDirW);

        // cookie attenuation
        #if defined(LIGHT{i}COOKIE)

            #if LIGHT{i}TYPE == SPOT
                #ifdef LIGHT{i}COOKIE_FALLOFF
                    #ifdef LIGHT{i}COOKIE_TRANSFORM
                        vec3 cookieAttenuation = getCookie2DXform(light{i}_cookie, light{i}_shadowMatrix, light{i}_cookieIntensity, light{i}_cookieMatrix, light{i}_cookieOffset).{LIGHT{i}COOKIE_CHANNEL};
                    #else
                        vec3 cookieAttenuation = getCookie2D(light{i}_cookie, light{i}_shadowMatrix, light{i}_cookieIntensity).{LIGHT{i}COOKIE_CHANNEL};
                    #endif
                #else
                    #ifdef LIGHT{i}COOKIE_TRANSFORM
                        vec3 cookieAttenuation = getCookie2DClipXform(light{i}_cookie, light{i}_shadowMatrix, light{i}_cookieIntensity, light{i}_cookieMatrix, light{i}_cookieOffset).{LIGHT{i}COOKIE_CHANNEL};
                    #else
                        vec3 cookieAttenuation = getCookie2DClip(light{i}_cookie, light{i}_shadowMatrix, light{i}_cookieIntensity).{LIGHT{i}COOKIE_CHANNEL};
                    #endif
                #endif
            #endif

            #if LIGHT{i}TYPE == OMNI
                vec3 cookieAttenuation = getCookieCube(light{i}_cookie, light{i}_shadowMatrix, light{i}_cookieIntensity).{LIGHT{i}COOKIE_CHANNEL};
            #endif

            // multiply light color by the cookie attenuation
            lightColor *= cookieAttenuation;

        #endif

        // distance falloff
        #if LIGHT{i}SHAPE == PUNCTUAL
            #if LIGHT{i}FALLOFF == LINEAR
                dAtten = getFalloffLinear(light{i}_radius, lightDirW);
            #else
                dAtten = getFalloffInvSquared(light{i}_radius, lightDirW);
            #endif
        #else
            // non punctual lights only gets the range window here
            dAtten = getFalloffWindow(light{i}_radius, lightDirW);
        #endif

        // spot light angle falloff
        #if LIGHT{i}TYPE == SPOT
            #if !defined(LIGHT{i}COOKIE) || defined(LIGHT{i}COOKIE_FALLOFF)
                dAtten *= getSpotEffect(light{i}_direction, light{i}_innerConeAngle, light{i}_outerConeAngle, dLightDirNormW);
            #endif
        #endif
    #endif

    if (dAtten < 0.00001) {
        return;
    }

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

    // diffuse lighting - LTC lights do not mix diffuse lighting into attenuation that affects specular
    #if LIGHT{i}SHAPE != PUNCTUAL

        // attenDiffuse - separate diffuse attenuation for non-punctual light sources

        #if LIGHT{i}TYPE == DIRECTIONAL
            // NB: A better approximation perhaps using wrap lighting could be implemented here
            float attenDiffuse = getLightDiffuse(litArgs_worldNormal, dViewDirW, dLightDirNormW);
        #else
            // 16.0 is a constant that is in getFalloffInvSquared()
            #if LIGHT{i}SHAPE == RECT
                float attenDiffuse = getRectLightDiffuse(litArgs_worldNormal, dViewDirW, lightDirW, dLightDirNormW) * 16.0;
            #elif LIGHT{i}SHAPE == DISK
                float attenDiffuse = getDiskLightDiffuse(litArgs_worldNormal, dViewDirW, lightDirW, dLightDirNormW) * 16.0;
            #elif LIGHT{i}SHAPE == SPHERE
                float attenDiffuse = getSphereLightDiffuse(litArgs_worldNormal, dViewDirW, lightDirW, dLightDirNormW) * 16.0;
            #endif
        #endif
    #else
        // one parameter is unused for punctual lights
        dAtten *= getLightDiffuse(litArgs_worldNormal, vec3(0.0), dLightDirNormW);
    #endif

    // apply the shadow attenuation
    #ifdef LIGHT{i}CASTSHADOW

        #if LIGHT{i}TYPE == DIRECTIONAL
            float shadow = getShadow{i}(vec3(0.0));
        #else
            float shadow = getShadow{i}(lightDirW);
        #endif

        // Apply shadow intensity to the shadow value
        shadow = mix(1.0, shadow, light{i}_shadowIntensity);

        dAtten *= shadow;

        #if defined(LIT_SHADOW_CATCHER) && LIGHT{i}TYPE == DIRECTIONAL
            // accumulate shadows for directional lights
            dShadowCatcher *= shadow;
        #endif            

    #endif

    #if LIGHT{i}SHAPE != PUNCTUAL
        // area light - they do not mix diffuse lighting into specular attenuation
        #ifdef LIT_SPECULAR
            dDiffuseLight += ((attenDiffuse * dAtten) * lightColor) * (1.0 - dLTCSpecFres);
        #else
            dDiffuseLight += (attenDiffuse * dAtten) * lightColor;
        #endif                        
    #else
        // punctual light
        #if defined(AREA_LIGHTS) && defined(LIT_SPECULAR)
            dDiffuseLight += (dAtten * lightColor) * (1.0 - litArgs_specularity);
        #else
            dDiffuseLight += dAtten * lightColor;
        #endif
    #endif

    // specular lighting
    #ifdef LIGHT{i}AFFECT_SPECULARITY

        #if LIGHT{i}SHAPE != PUNCTUAL // area light

            #ifdef LIT_CLEARCOAT
                #if LIGHT{i}SHAPE == RECT
                    ccSpecularLight += ccLTCSpecFres * getRectLightSpecular(litArgs_clearcoat_worldNormal, dViewDirW) * dAtten * lightColor;
                #elif LIGHT{i}SHAPE == DISK
                    ccSpecularLight += ccLTCSpecFres * getDiskLightSpecular(litArgs_clearcoat_worldNormal, dViewDirW) * dAtten * lightColor;
                #elif LIGHT{i}SHAPE == SPHERE
                    ccSpecularLight += ccLTCSpecFres * getSphereLightSpecular(litArgs_clearcoat_worldNormal, dViewDirW) * dAtten * lightColor;
                #endif
            #endif

            #ifdef LIT_SPECULAR
                #if LIGHT{i}SHAPE == RECT
                    dSpecularLight += dLTCSpecFres * getRectLightSpecular(litArgs_worldNormal, dViewDirW) * dAtten * lightColor;
                #elif LIGHT{i}SHAPE == DISK
                    dSpecularLight += dLTCSpecFres * getDiskLightSpecular(litArgs_worldNormal, dViewDirW) * dAtten * lightColor;
                #elif LIGHT{i}SHAPE == SPHERE
                    dSpecularLight += dLTCSpecFres * getSphereLightSpecular(litArgs_worldNormal, dViewDirW) * dAtten * lightColor;
                #endif
            #endif

        #else // punctual light

            // is fresnel needed
            #if LIGHT{i}TYPE == DIRECTIONAL && LIT_FRESNEL_MODEL != NONE
                #define LIGHT{i}FRESNEL
            #endif

            #ifdef LIT_SPECULAR
                vec3 halfDirW = normalize(-dLightDirNormW + dViewDirW);
            #endif

            // if LTC lights are present, specular must be accumulated with specularity (specularity is pre multiplied by punctual light fresnel)
            #ifdef LIT_CLEARCOAT
                vec3 lightspecularCC = getLightSpecular(halfDirW, ccReflDirW, litArgs_clearcoat_worldNormal, dViewDirW, dLightDirNormW, litArgs_clearcoat_gloss, dTBN) * dAtten * lightColor;
                #ifdef LIGHT{i}FRESNEL
                    lightspecularCC *= getFresnelCC(dot(dViewDirW, halfDirW));
                #endif
                ccSpecularLight += lightspecularCC;
            #endif

            #ifdef LIT_SHEEN
                sSpecularLight += getLightSpecularSheen(halfDirW, litArgs_worldNormal, dViewDirW, dLightDirNormW, litArgs_sheen_gloss) * dAtten * lightColor;
            #endif

            #ifdef LIT_SPECULAR

                vec3 lightSpecular = getLightSpecular(halfDirW, dReflDirW, litArgs_worldNormal, dViewDirW, dLightDirNormW, litArgs_gloss, dTBN) * dAtten * lightColor;
                #ifdef LIGHT{i}FRESNEL

                    #if defined(LIT_IRIDESCENCE)
                        lightSpecular *= getFresnel(dot(dViewDirW, halfDirW), litArgs_gloss, litArgs_specularity, iridescenceFresnel, litArgs_iridescence_intensity);
                    #else
                        lightSpecular *= getFresnel(dot(dViewDirW, halfDirW), litArgs_gloss, litArgs_specularity);
                    #endif

                #else
                    lightSpecular *= litArgs_specularity;
                #endif
                
                dSpecularLight += lightSpecular;
            #endif
        #endif
    #endif
}
#endif
`;
