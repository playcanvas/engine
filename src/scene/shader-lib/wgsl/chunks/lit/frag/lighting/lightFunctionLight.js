// functions used to evaluate the light
export default /* wgsl */`
#if defined(LIGHT{i})

fn evaluateLight{i}(
    #if defined(LIT_IRIDESCENCE)
        iridescenceFresnel: vec3f
    #endif
) {
    // light color
    var lightColor: vec3f = uniform.light{i}_color;

    #if LIGHT{i}TYPE == DIRECTIONAL && !defined(LIT_SHADOW_CATCHER)
        // early return if the light color is black (used by shadow catcher - this way this light is very cheap)
        if (all(lightColor == vec3f(0.0, 0.0, 0.0))) {
            return;
        }
    #endif

    #if LIGHT{i}TYPE == DIRECTIONAL // directional light

        dLightDirNormW = uniform.light{i}_direction;
        dAtten = 1.0;

    #else // omni or spot light

        var lightDirW: vec3f = evalOmniLight(uniform.light{i}_position);
        dLightDirNormW = normalize(lightDirW);

        // cookie attenuation
        #if defined(LIGHT{i}COOKIE)

            #if LIGHT{i}TYPE == SPOT
                #ifdef LIGHT{i}COOKIE_FALLOFF
                    #ifdef LIGHT{i}COOKIE_TRANSFORM
                        var cookieAttenuation: vec3f = getCookie2DXform(uniform.light{i}_cookie, uniform.light{i}_shadowMatrix, uniform.light{i}_cookieIntensity, uniform.light{i}_cookieMatrix, uniform.light{i}_cookieOffset).{LIGHT{i}COOKIE_CHANNEL};
                    #else
                        var cookieAttenuation: vec3f = getCookie2D(uniform.light{i}_cookie, uniform.light{i}_shadowMatrix, uniform.light{i}_cookieIntensity).{LIGHT{i}COOKIE_CHANNEL};
                    #endif
                #else
                    #ifdef LIGHT{i}COOKIE_TRANSFORM
                        var cookieAttenuation: vec3f = getCookie2DClipXform(uniform.light{i}_cookie, uniform.light{i}_shadowMatrix, uniform.light{i}_cookieIntensity, uniform.light{i}_cookieMatrix, uniform.light{i}_cookieOffset).{LIGHT{i}COOKIE_CHANNEL};
                    #else
                        var cookieAttenuation: vec3f = getCookie2DClip(uniform.light{i}_cookie, uniform.light{i}_shadowMatrix, uniform.light{i}_cookieIntensity).{LIGHT{i}COOKIE_CHANNEL};
                    #endif
                #endif
            #endif

            #if LIGHT{i}TYPE == OMNI
                var cookieAttenuation: vec3f = getCookieCube(uniform.light{i}_cookie, uniform.light{i}_shadowMatrix, uniform.light{i}_cookieIntensity).{LIGHT{i}COOKIE_CHANNEL};
            #endif

            // multiply light color by the cookie attenuation
            lightColor = lightColor * cookieAttenuation;

        #endif

        // distance falloff
        #if LIGHT{i}SHAPE == PUNCTUAL
            #if LIGHT{i}FALLOFF == LINEAR
                dAtten = getFalloffLinear(uniform.light{i}_radius, lightDirW);
            #else
                dAtten = getFalloffInvSquared(uniform.light{i}_radius, lightDirW);
            #endif
        #else
            // non punctual lights only gets the range window here
            dAtten = getFalloffWindow(uniform.light{i}_radius, lightDirW);
        #endif

        // spot light angle falloff
        #if LIGHT{i}TYPE == SPOT
            #if !defined(LIGHT{i}COOKIE) || defined(LIGHT{i}COOKIE_FALLOFF)
                dAtten = dAtten * getSpotEffect(uniform.light{i}_direction, uniform.light{i}_innerConeAngle, uniform.light{i}_outerConeAngle, dLightDirNormW);
            #endif
        #endif
    #endif

    if (dAtten < 0.00001) {
        return;
    }

    // evaluate area light values
    #if LIGHT{i}SHAPE != PUNCTUAL
        #if LIGHT{i}SHAPE == RECT
            calcRectLightValues(uniform.light{i}_position, uniform.light{i}_halfWidth, uniform.light{i}_halfHeight);
        #elif LIGHT{i}SHAPE == DISK
            calcDiskLightValues(uniform.light{i}_position, uniform.light{i}_halfWidth, uniform.light{i}_halfHeight);
        #elif LIGHT{i}SHAPE == SPHERE
            calcSphereLightValues(uniform.light{i}_position, uniform.light{i}_halfWidth, uniform.light{i}_halfHeight);
        #endif
    #endif

    // diffuse lighting - LTC lights do not mix diffuse lighting into attenuation that affects specular
    #if LIGHT{i}SHAPE != PUNCTUAL

        // attenDiffuse - separate diffuse attenuation for non-punctual light sources

        #if LIGHT{i}TYPE == DIRECTIONAL
            // NB: A better approximation perhaps using wrap lighting could be implemented here
            var attenDiffuse: f32 = getLightDiffuse(litArgs_worldNormal, dViewDirW, dLightDirNormW);
        #else
            // 16.0 is a constant that is in getFalloffInvSquared()
            #if LIGHT{i}SHAPE == RECT
                var attenDiffuse: f32 = getRectLightDiffuse(litArgs_worldNormal, dViewDirW, lightDirW, dLightDirNormW) * 16.0;
            #elif LIGHT{i}SHAPE == DISK
                var attenDiffuse: f32 = getDiskLightDiffuse(litArgs_worldNormal, dViewDirW, lightDirW, dLightDirNormW) * 16.0;
            #elif LIGHT{i}SHAPE == SPHERE
                var attenDiffuse: f32 = getSphereLightDiffuse(litArgs_worldNormal, dViewDirW, lightDirW, dLightDirNormW) * 16.0;
            #endif
        #endif
    #else
        // one parameter is unused for punctual lights
        dAtten = dAtten * getLightDiffuse(litArgs_worldNormal, vec3(0.0), dLightDirNormW);
    #endif

    // apply the shadow attenuation
    #ifdef LIGHT{i}CASTSHADOW

        #if LIGHT{i}TYPE == DIRECTIONAL
            var shadow: f32 = getShadow{i}(vec3(0.0));
        #else
            var shadow: f32 = getShadow{i}(lightDirW);
        #endif

        // Apply shadow intensity to the shadow value
        shadow = mix(1.0, shadow, uniform.light{i}_shadowIntensity);

        dAtten = dAtten * shadow;

        #if defined(LIT_SHADOW_CATCHER) && LIGHT{i}TYPE == DIRECTIONAL
            // accumulate shadows for directional lights
            dShadowCatcher = dShadowCatcher * shadow;
        #endif            

    #endif

    #if LIGHT{i}SHAPE != PUNCTUAL
        // area light - they do not mix diffuse lighting into specular attenuation
        #ifdef LIT_SPECULAR
            dDiffuseLight = dDiffuseLight + (((attenDiffuse * dAtten) * lightColor) * (1.0 - dLTCSpecFres));
        #else
            dDiffuseLight = dDiffuseLight + ((attenDiffuse * dAtten) * lightColor);
        #endif                        
    #else
        // punctual light
        #if defined(AREA_LIGHTS) && defined(LIT_SPECULAR)
            dDiffuseLight = dDiffuseLight + ((dAtten * lightColor) * (1.0 - litArgs_specularity));
        #else
            dDiffuseLight = dDiffuseLight + (dAtten * lightColor);
        #endif
    #endif

    // specular lighting
    #ifdef LIGHT{i}AFFECT_SPECULARITY

        #if LIGHT{i}SHAPE != PUNCTUAL // area light

            #ifdef LIT_CLEARCOAT
                #if LIGHT{i}SHAPE == RECT
                    ccSpecularLight = ccSpecularLight + (ccLTCSpecFres * getRectLightSpecular(litArgs_clearcoat_worldNormal, dViewDirW) * dAtten * lightColor);
                #elif LIGHT{i}SHAPE == DISK
                    ccSpecularLight = ccSpecularLight + (ccLTCSpecFres * getDiskLightSpecular(litArgs_clearcoat_worldNormal, dViewDirW) * dAtten * lightColor);
                #elif LIGHT{i}SHAPE == SPHERE
                    ccSpecularLight = ccSpecularLight + (ccLTCSpecFres * getSphereLightSpecular(litArgs_clearcoat_worldNormal, dViewDirW) * dAtten * lightColor);
                #endif
            #endif

            #ifdef LIT_SPECULAR
                #if LIGHT{i}SHAPE == RECT
                    dSpecularLight = dSpecularLight + (dLTCSpecFres * getRectLightSpecular(litArgs_worldNormal, dViewDirW) * dAtten * lightColor);
                #elif LIGHT{i}SHAPE == DISK
                    dSpecularLight = dSpecularLight + (dLTCSpecFres * getDiskLightSpecular(litArgs_worldNormal, dViewDirW) * dAtten * lightColor);
                #elif LIGHT{i}SHAPE == SPHERE
                    dSpecularLight = dSpecularLight + (dLTCSpecFres * getSphereLightSpecular(litArgs_worldNormal, dViewDirW) * dAtten * lightColor);
                #endif
            #endif

        #else // punctual light

            // is fresnel needed
            #if LIGHT{i}TYPE == DIRECTIONAL && LIT_FRESNEL_MODEL != NONE
                #define LIGHT{i}FRESNEL
            #endif

            #ifdef LIT_SPECULAR
                var halfDirW: vec3f = normalize(-dLightDirNormW + dViewDirW);
            #endif

            // if LTC lights are present, specular must be accumulated with specularity (specularity is pre multiplied by punctual light fresnel)
            #ifdef LIT_CLEARCOAT
                var lightspecularCC: vec3f = getLightSpecular(halfDirW, ccReflDirW, litArgs_clearcoat_worldNormal, dViewDirW, dLightDirNormW, litArgs_clearcoat_gloss, dTBN) * dAtten * lightColor;
                #ifdef LIGHT{i}FRESNEL
                    lightspecularCC = lightspecularCC * getFresnelCC(dot(dViewDirW, halfDirW));
                #endif
                ccSpecularLight = ccSpecularLight + lightspecularCC;
            #endif

            #ifdef LIT_SHEEN
                sSpecularLight = sSpecularLight + (getLightSpecularSheen(halfDirW, litArgs_worldNormal, dViewDirW, dLightDirNormW, litArgs_sheen_gloss) * dAtten * lightColor);
            #endif

            #ifdef LIT_SPECULAR

                var lightSpecular: vec3f = getLightSpecular(halfDirW, dReflDirW, litArgs_worldNormal, dViewDirW, dLightDirNormW, litArgs_gloss, dTBN) * dAtten * lightColor;
                #ifdef LIGHT{i}FRESNEL

                    #if defined(LIT_IRIDESCENCE)
                        lightSpecular = lightSpecular * getFresnel(dot(dViewDirW, halfDirW), litArgs_gloss, litArgs_specularity, iridescenceFresnel, litArgs_iridescence_intensity);
                    #else
                        lightSpecular = lightSpecular * getFresnel(dot(dViewDirW, halfDirW), litArgs_gloss, litArgs_specularity);
                    #endif

                #else
                    lightSpecular = lightSpecular * litArgs_specularity;
                #endif
                
                dSpecularLight = dSpecularLight + lightSpecular;
            #endif
        #endif
    #endif
}
#endif
`;
