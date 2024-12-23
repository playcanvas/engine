export default /* glsl */`
uniform highp sampler2D clusterWorldTexture;
uniform highp sampler2D lightsTexture8;
uniform highp sampler2D lightsTextureFloat;

// complex ifdef expression are not supported, handle it here
// defined(CLUSTER_COOKIES) || defined(CLUSTER_SHADOWS)
#if defined(CLUSTER_COOKIES)
    #define CLUSTER_COOKIES_OR_SHADOWS
#endif
#if defined(CLUSTER_SHADOWS)
    #define CLUSTER_COOKIES_OR_SHADOWS
#endif

#ifdef CLUSTER_SHADOWS
    // TODO: when VSM shadow is supported, it needs to use sampler2D in webgl2
    uniform sampler2DShadow shadowAtlasTexture;
#endif

#ifdef CLUSTER_COOKIES
    uniform sampler2D cookieAtlasTexture;
#endif

uniform int clusterMaxCells;

// 1.0 if clustered lighting can be skipped (0 lights in the clusters)
uniform float clusterSkip;

uniform vec3 clusterCellsCountByBoundsSize;
uniform vec3 clusterTextureSize;
uniform vec3 clusterBoundsMin;
uniform vec3 clusterBoundsDelta;
uniform vec3 clusterCellsDot;
uniform vec3 clusterCellsMax;
uniform vec2 clusterCompressionLimit0;
uniform vec2 shadowAtlasParams;

// structure storing light properties of a clustered light
// it's sorted to have all vectors aligned to 4 floats to limit padding
struct ClusterLightData {

    // area light sizes / orientation
    vec3 halfWidth;

    // type of the light (spot or omni)
    float lightType;

    // area light sizes / orientation
    vec3 halfHeight;

    // light index
    int lightIndex;

    // world space position
    vec3 position;

    // area light shape
    float shape;

    // world space direction (spot light only)
    vec3 direction;

    // light follow mode
    float falloffMode;

    // color
    vec3 color;

    // 0.0 if the light doesn't cast shadows
    float shadowIntensity;

    // atlas viewport for omni light shadow and cookie (.xy is offset to the viewport slot, .z is size of the face in the atlas)
    vec3 omniAtlasViewport;

    // range of the light
    float range;

    // channel mask - one of the channels has 1, the others are 0
    vec4 cookieChannelMask;

    // shadow bias values
    float shadowBias;
    float shadowNormalBias;

    // spot light inner and outer angle cosine
    float innerConeAngleCos;
    float outerConeAngleCos;

    // 1.0 if the light has a cookie texture
    float cookie;

    // 1.0 if cookie texture is rgb, otherwise it is using a single channel selectable by cookieChannelMask
    float cookieRgb;

    // intensity of the cookie
    float cookieIntensity;

    // light mask
    float mask;
};

// Note: on some devices (tested on Pixel 3A XL), this matrix when stored inside the light struct has lower precision compared to
// when stored outside, so we store it outside to avoid spot shadow flickering. This might need to be done to other / all members
// of the structure if further similar issues are observed.

// shadow (spot light only) / cookie projection matrix
mat4 lightProjectionMatrix;

// macros for light properties
#define isClusteredLightCastShadow(light) ( light.shadowIntensity > 0.0 )
#define isClusteredLightCookie(light) (light.cookie > 0.5 )
#define isClusteredLightCookieRgb(light) (light.cookieRgb > 0.5 )
#define isClusteredLightSpot(light) ( light.lightType > 0.5 )
#define isClusteredLightFalloffLinear(light) ( light.falloffMode < 0.5 )

// macros to test light shape
// Note: Following functions need to be called serially in listed order as they do not test both '>' and '<'
#define isClusteredLightArea(light) ( light.shape > 0.1 )
#define isClusteredLightRect(light) ( light.shape < 0.3 )
#define isClusteredLightDisk(light) ( light.shape < 0.6 )

// macro to test light mask (mesh accepts dynamic vs lightmapped lights)
#ifdef CLUSTER_MESH_DYNAMIC_LIGHTS
    // accept lights marked as dynamic or both dynamic and lightmapped
    #define acceptLightMask(light) ( light.mask < 0.75)
#else
    // accept lights marked as lightmapped or both dynamic and lightmapped
    #define acceptLightMask(light) ( light.mask > 0.25)
#endif

vec4 decodeClusterLowRange4Vec4(vec4 d0, vec4 d1, vec4 d2, vec4 d3) {
    return vec4(
        bytes2floatRange4(d0, -2.0, 2.0),
        bytes2floatRange4(d1, -2.0, 2.0),
        bytes2floatRange4(d2, -2.0, 2.0),
        bytes2floatRange4(d3, -2.0, 2.0)
    );
}

vec4 sampleLightsTexture8(const ClusterLightData clusterLightData, int index) {
    return texelFetch(lightsTexture8, ivec2(index, clusterLightData.lightIndex), 0);
}

vec4 sampleLightTextureF(const ClusterLightData clusterLightData, int index) {
    return texelFetch(lightsTextureFloat, ivec2(index, clusterLightData.lightIndex), 0);
}

void decodeClusterLightCore(inout ClusterLightData clusterLightData, float lightIndex) {

    // light index
    clusterLightData.lightIndex = int(lightIndex);

    // shared data from 8bit texture
    vec4 lightInfo = sampleLightsTexture8(clusterLightData, CLUSTER_TEXTURE_8_FLAGS);
    clusterLightData.lightType = lightInfo.x;
    clusterLightData.shape = lightInfo.y;
    clusterLightData.falloffMode = lightInfo.z;
    clusterLightData.shadowIntensity = lightInfo.w;

    // color
    vec4 colorA = sampleLightsTexture8(clusterLightData, CLUSTER_TEXTURE_8_COLOR_A);
    vec4 colorB = sampleLightsTexture8(clusterLightData, CLUSTER_TEXTURE_8_COLOR_B);
    clusterLightData.color = vec3(bytes2float2(colorA.xy), bytes2float2(colorA.zw), bytes2float2(colorB.xy)) * clusterCompressionLimit0.y;

    // cookie
    clusterLightData.cookie = colorB.z;

    // light mask
    clusterLightData.mask = colorB.w;

    vec4 lightPosRange = sampleLightTextureF(clusterLightData, CLUSTER_TEXTURE_F_POSITION_RANGE);
    clusterLightData.position = lightPosRange.xyz;
    clusterLightData.range = lightPosRange.w;

    // spot light direction
    vec4 lightDir_Unused = sampleLightTextureF(clusterLightData, CLUSTER_TEXTURE_F_SPOT_DIRECTION);
    clusterLightData.direction = lightDir_Unused.xyz;
}

void decodeClusterLightSpot(inout ClusterLightData clusterLightData) {

    // spot light cos angles
    vec4 coneAngle = sampleLightsTexture8(clusterLightData, CLUSTER_TEXTURE_8_SPOT_ANGLES);
    clusterLightData.innerConeAngleCos = bytes2float2(coneAngle.xy) * 2.0 - 1.0;
    clusterLightData.outerConeAngleCos = bytes2float2(coneAngle.zw) * 2.0 - 1.0;
}

void decodeClusterLightOmniAtlasViewport(inout ClusterLightData clusterLightData) {
    clusterLightData.omniAtlasViewport = sampleLightTextureF(clusterLightData, CLUSTER_TEXTURE_F_PROJ_MAT_0).xyz;
}

void decodeClusterLightAreaData(inout ClusterLightData clusterLightData) {
    clusterLightData.halfWidth = sampleLightTextureF(clusterLightData, CLUSTER_TEXTURE_F_AREA_DATA_WIDTH).xyz;
    clusterLightData.halfHeight = sampleLightTextureF(clusterLightData, CLUSTER_TEXTURE_F_AREA_DATA_HEIGHT).xyz;
}

void decodeClusterLightProjectionMatrixData(inout ClusterLightData clusterLightData) {
    
    // shadow matrix
    vec4 m0 = sampleLightTextureF(clusterLightData, CLUSTER_TEXTURE_F_PROJ_MAT_0);
    vec4 m1 = sampleLightTextureF(clusterLightData, CLUSTER_TEXTURE_F_PROJ_MAT_1);
    vec4 m2 = sampleLightTextureF(clusterLightData, CLUSTER_TEXTURE_F_PROJ_MAT_2);
    vec4 m3 = sampleLightTextureF(clusterLightData, CLUSTER_TEXTURE_F_PROJ_MAT_3);
    lightProjectionMatrix = mat4(m0, m1, m2, m3);
}

void decodeClusterLightShadowData(inout ClusterLightData clusterLightData) {
    
    // shadow biases
    vec4 biases = sampleLightsTexture8(clusterLightData, CLUSTER_TEXTURE_8_SHADOW_BIAS);
    clusterLightData.shadowBias = bytes2floatRange2(biases.xy, -1.0, 20.0),
    clusterLightData.shadowNormalBias = bytes2float2(biases.zw);
}

void decodeClusterLightCookieData(inout ClusterLightData clusterLightData) {

    vec4 cookieA = sampleLightsTexture8(clusterLightData, CLUSTER_TEXTURE_8_COOKIE_A);
    clusterLightData.cookieIntensity = cookieA.x;
    clusterLightData.cookieRgb = cookieA.y;

    clusterLightData.cookieChannelMask = sampleLightsTexture8(clusterLightData, CLUSTER_TEXTURE_8_COOKIE_B);
}

void evaluateLight(
    ClusterLightData light, 
    vec3 worldNormal, 
    vec3 viewDir, 
    vec3 reflectionDir,
#if defined(LIT_CLEARCOAT)
    vec3 clearcoatReflectionDir,
#endif
    float gloss, 
    vec3 specularity, 
    vec3 geometricNormal, 
    mat3 tbn, 
#if defined(LIT_IRIDESCENCE)
    vec3 iridescenceFresnel,
#endif
    vec3 clearcoat_worldNormal,
    float clearcoat_gloss,
    float sheen_gloss,
    float iridescence_intensity
) {

    vec3 cookieAttenuation = vec3(1.0);
    float diffuseAttenuation = 1.0;
    float falloffAttenuation = 1.0;

    // evaluate omni part of the light
    getLightDirPoint(light.position);

    #ifdef CLUSTER_AREALIGHTS

    // distance attenuation
    if (isClusteredLightArea(light)) { // area light

        // area lights
        decodeClusterLightAreaData(light);

        // handle light shape
        if (isClusteredLightRect(light)) {
            calcRectLightValues(light.position, light.halfWidth, light.halfHeight);
        } else if (isClusteredLightDisk(light)) {
            calcDiskLightValues(light.position, light.halfWidth, light.halfHeight);
        } else { // sphere
            calcSphereLightValues(light.position, light.halfWidth, light.halfHeight);
        }

        falloffAttenuation = getFalloffWindow(light.range, dLightDirW);

    } else

    #endif

    {   // punctual light

        if (isClusteredLightFalloffLinear(light))
            falloffAttenuation = getFalloffLinear(light.range, dLightDirW);
        else
            falloffAttenuation = getFalloffInvSquared(light.range, dLightDirW);
    }

    if (falloffAttenuation > 0.00001) {

        #ifdef CLUSTER_AREALIGHTS

        if (isClusteredLightArea(light)) { // area light

            // handle light shape
            if (isClusteredLightRect(light)) {
                diffuseAttenuation = getRectLightDiffuse(worldNormal, viewDir, dLightDirW, dLightDirNormW) * 16.0;
            } else if (isClusteredLightDisk(light)) {
                diffuseAttenuation = getDiskLightDiffuse(worldNormal, viewDir, dLightDirW, dLightDirNormW) * 16.0;
            } else { // sphere
                diffuseAttenuation = getSphereLightDiffuse(worldNormal, viewDir, dLightDirW, dLightDirNormW) * 16.0;
            }

        } else

        #endif

        {
            falloffAttenuation *= getLightDiffuse(worldNormal, viewDir, dLightDirW, dLightDirNormW); 
        }

        // spot light falloff
        if (isClusteredLightSpot(light)) {
            decodeClusterLightSpot(light);
            falloffAttenuation *= getSpotEffect(light.direction, light.innerConeAngleCos, light.outerConeAngleCos, dLightDirNormW);
        }

        #if defined(CLUSTER_COOKIES_OR_SHADOWS)

        if (falloffAttenuation > 0.00001) {

            // shadow / cookie
            if (isClusteredLightCastShadow(light) || isClusteredLightCookie(light)) {

                // shared shadow / cookie data depends on light type
                if (isClusteredLightSpot(light)) {
                    decodeClusterLightProjectionMatrixData(light);
                } else {
                    decodeClusterLightOmniAtlasViewport(light);
                }

                float shadowTextureResolution = shadowAtlasParams.x;
                float shadowEdgePixels = shadowAtlasParams.y;

                #ifdef CLUSTER_COOKIES

                // cookie
                if (isClusteredLightCookie(light)) {
                    decodeClusterLightCookieData(light);

                    if (isClusteredLightSpot(light)) {
                        cookieAttenuation = getCookie2DClustered(TEXTURE_PASS(cookieAtlasTexture), lightProjectionMatrix, vPositionW, light.cookieIntensity, isClusteredLightCookieRgb(light), light.cookieChannelMask);
                    } else {
                        cookieAttenuation = getCookieCubeClustered(TEXTURE_PASS(cookieAtlasTexture), dLightDirW, light.cookieIntensity, isClusteredLightCookieRgb(light), light.cookieChannelMask, shadowTextureResolution, shadowEdgePixels, light.omniAtlasViewport);
                    }
                }

                #endif

                #ifdef CLUSTER_SHADOWS

                // shadow
                if (isClusteredLightCastShadow(light)) {
                    decodeClusterLightShadowData(light);

                    vec4 shadowParams = vec4(shadowTextureResolution, light.shadowNormalBias, light.shadowBias, 1.0 / light.range);

                    if (isClusteredLightSpot(light)) {

                        // spot shadow
                        getShadowCoordPerspZbufferNormalOffset(lightProjectionMatrix, shadowParams, geometricNormal);
                        
                        #if defined(CLUSTER_SHADOW_TYPE_PCF1)
                            float shadow = getShadowSpotClusteredPCF1(SHADOWMAP_PASS(shadowAtlasTexture), dShadowCoord, shadowParams);
                        #elif defined(CLUSTER_SHADOW_TYPE_PCF3)
                            float shadow = getShadowSpotClusteredPCF3(SHADOWMAP_PASS(shadowAtlasTexture), dShadowCoord, shadowParams);
                        #elif defined(CLUSTER_SHADOW_TYPE_PCF5)
                            float shadow = getShadowSpotClusteredPCF5(SHADOWMAP_PASS(shadowAtlasTexture), dShadowCoord, shadowParams);
                        #elif defined(CLUSTER_SHADOW_TYPE_PCSS)
                            float shadow = getShadowSpotClusteredPCSS(SHADOWMAP_PASS(shadowAtlasTexture), dShadowCoord, shadowParams);
                        #endif
                        falloffAttenuation *= mix(1.0, shadow, light.shadowIntensity);

                    } else {

                        // omni shadow
                        vec3 dir = normalOffsetPointShadow(shadowParams, dLightPosW, dLightDirW, dLightDirNormW, geometricNormal);  // normalBias adjusted for distance

                        #if defined(CLUSTER_SHADOW_TYPE_PCF1)
                            float shadow = getShadowOmniClusteredPCF1(SHADOWMAP_PASS(shadowAtlasTexture), shadowParams, light.omniAtlasViewport, shadowEdgePixels, dir);
                        #elif defined(CLUSTER_SHADOW_TYPE_PCF3)
                            float shadow = getShadowOmniClusteredPCF3(SHADOWMAP_PASS(shadowAtlasTexture), shadowParams, light.omniAtlasViewport, shadowEdgePixels, dir);
                        #elif defined(CLUSTER_SHADOW_TYPE_PCF5)
                            float shadow = getShadowOmniClusteredPCF5(SHADOWMAP_PASS(shadowAtlasTexture), shadowParams, light.omniAtlasViewport, shadowEdgePixels, dir);
                        #endif
                        falloffAttenuation *= mix(1.0, shadow, light.shadowIntensity);
                    }
                }

                #endif
            }
        }

        #endif

        // diffuse / specular / clearcoat
        #ifdef CLUSTER_AREALIGHTS

        if (isClusteredLightArea(light)) { // area light

            // area light diffuse
            {
                vec3 areaDiffuse = (diffuseAttenuation * falloffAttenuation) * light.color * cookieAttenuation;

                #if defined(LIT_SPECULAR)
                    areaDiffuse = mix(areaDiffuse, vec3(0), dLTCSpecFres);
                #endif

                // area light diffuse - it does not mix diffuse lighting into specular attenuation
                dDiffuseLight += areaDiffuse;
            }

            // specular and clear coat are material settings and get included by a define based on the material
            #ifdef LIT_SPECULAR

                // area light specular
                float areaLightSpecular;

                if (isClusteredLightRect(light)) {
                    areaLightSpecular = getRectLightSpecular(worldNormal, viewDir);
                } else if (isClusteredLightDisk(light)) {
                    areaLightSpecular = getDiskLightSpecular(worldNormal, viewDir);
                } else { // sphere
                    areaLightSpecular = getSphereLightSpecular(worldNormal, viewDir);
                }

                dSpecularLight += dLTCSpecFres * areaLightSpecular * falloffAttenuation * light.color * cookieAttenuation;

                #ifdef LIT_CLEARCOAT

                    // area light specular clear coat
                    float areaLightSpecularCC;

                    if (isClusteredLightRect(light)) {
                        areaLightSpecularCC = getRectLightSpecular(clearcoat_worldNormal, viewDir);
                    } else if (isClusteredLightDisk(light)) {
                        areaLightSpecularCC = getDiskLightSpecular(clearcoat_worldNormal, viewDir);
                    } else { // sphere
                        areaLightSpecularCC = getSphereLightSpecular(clearcoat_worldNormal, viewDir);
                    }

                    ccSpecularLight += ccLTCSpecFres * areaLightSpecularCC * falloffAttenuation * light.color  * cookieAttenuation;

                #endif

            #endif

        } else

        #endif

        {    // punctual light

            // punctual light diffuse
            {
                vec3 punctualDiffuse = falloffAttenuation * light.color * cookieAttenuation;

                #if defined(CLUSTER_AREALIGHTS)
                #if defined(LIT_SPECULAR)
                    punctualDiffuse = mix(punctualDiffuse, vec3(0), specularity);
                #endif
                #endif

                dDiffuseLight += punctualDiffuse;
            }
   
            // specular and clear coat are material settings and get included by a define based on the material
            #ifdef LIT_SPECULAR

                vec3 halfDir = normalize(-dLightDirNormW + viewDir);
                
                // specular
                #ifdef LIT_SPECULAR_FRESNEL
                    dSpecularLight += 
                        getLightSpecular(halfDir, reflectionDir, worldNormal, viewDir, dLightDirNormW, gloss, tbn) * falloffAttenuation * light.color * cookieAttenuation * 
                        getFresnel(
                            dot(viewDir, halfDir), 
                            gloss, 
                            specularity
                        #if defined(LIT_IRIDESCENCE)
                            , iridescenceFresnel,
                            iridescence_intensity
                        #endif
                            );
                #else
                    dSpecularLight += getLightSpecular(halfDir, reflectionDir, worldNormal, viewDir, dLightDirNormW, gloss, tbn) * falloffAttenuation * light.color * cookieAttenuation * specularity;
                #endif

                #ifdef LIT_CLEARCOAT
                    #ifdef LIT_SPECULAR_FRESNEL
                        ccSpecularLight += getLightSpecular(halfDir, clearcoatReflectionDir, clearcoat_worldNormal, viewDir, dLightDirNormW, clearcoat_gloss, tbn) * falloffAttenuation * light.color * cookieAttenuation * getFresnelCC(dot(viewDir, halfDir));
                    #else
                        ccSpecularLight += getLightSpecular(halfDir, clearcoatReflectionDir, clearcoat_worldNormal, viewDir, dLightDirNormW, clearcoat_gloss, tbn) * falloffAttenuation * light.color * cookieAttenuation; 
                    #endif
                #endif

                #ifdef LIT_SHEEN
                    sSpecularLight += getLightSpecularSheen(halfDir, worldNormal, viewDir, dLightDirNormW, sheen_gloss) * falloffAttenuation * light.color * cookieAttenuation;
                #endif

            #endif
        }
    }

    // Write to global attenuation values (for lightmapper)
    dAtten = falloffAttenuation;
    dAttenD = diffuseAttenuation;
    dAtten3 = cookieAttenuation;
}

void evaluateClusterLight(
    float lightIndex, 
    vec3 worldNormal, 
    vec3 viewDir, 
    vec3 reflectionDir, 
#if defined(LIT_CLEARCOAT)
    vec3 clearcoatReflectionDir,
#endif
    float gloss, 
    vec3 specularity, 
    vec3 geometricNormal, 
    mat3 tbn, 
#if defined(LIT_IRIDESCENCE)
    vec3 iridescenceFresnel,
#endif
    vec3 clearcoat_worldNormal,
    float clearcoat_gloss,
    float sheen_gloss,
    float iridescence_intensity
) {

    // decode core light data from textures
    ClusterLightData clusterLightData;
    decodeClusterLightCore(clusterLightData, lightIndex);

    // evaluate light if it uses accepted light mask
    if (acceptLightMask(clusterLightData))
        evaluateLight(
            clusterLightData, 
            worldNormal, 
            viewDir, 
            reflectionDir, 
#if defined(LIT_CLEARCOAT)
            clearcoatReflectionDir, 
#endif
            gloss, 
            specularity, 
            geometricNormal, 
            tbn, 
#if defined(LIT_IRIDESCENCE)
            iridescenceFresnel,
#endif
            clearcoat_worldNormal,
            clearcoat_gloss,
            sheen_gloss,
            iridescence_intensity
        );
}

void addClusteredLights(
    vec3 worldNormal, 
    vec3 viewDir, 
    vec3 reflectionDir, 
#if defined(LIT_CLEARCOAT)
    vec3 clearcoatReflectionDir,
#endif
    float gloss, 
    vec3 specularity, 
    vec3 geometricNormal, 
    mat3 tbn, 
#if defined(LIT_IRIDESCENCE)
    vec3 iridescenceFresnel,
#endif
    vec3 clearcoat_worldNormal,
    float clearcoat_gloss,
    float sheen_gloss,
    float iridescence_intensity
) {

    // skip lights if no lights at all
    if (clusterSkip > 0.5)
        return;

    // world space position to 3d integer cell cordinates in the cluster structure
    vec3 cellCoords = floor((vPositionW - clusterBoundsMin) * clusterCellsCountByBoundsSize);

    // no lighting when cell coordinate is out of range
    if (!(any(lessThan(cellCoords, vec3(0.0))) || any(greaterThanEqual(cellCoords, clusterCellsMax)))) {

        // cell index (mapping from 3d cell coordinates to linear memory)
        float cellIndex = dot(clusterCellsDot, cellCoords);

        // convert cell index to uv coordinates
        float clusterV = floor(cellIndex * clusterTextureSize.y);
        float clusterU = cellIndex - (clusterV * clusterTextureSize.x);

        // loop over maximum number of light cells
        for (int lightCellIndex = 0; lightCellIndex < clusterMaxCells; lightCellIndex++) {

            // using a single channel texture with data in alpha channel
            float lightIndex = texelFetch(clusterWorldTexture, ivec2(int(clusterU) + lightCellIndex, clusterV), 0).x;

            if (lightIndex <= 0.0)
                    return;

            evaluateClusterLight(
                lightIndex * 255.0, 
                worldNormal, 
                viewDir, 
                reflectionDir,
#if defined(LIT_CLEARCOAT)
                clearcoatReflectionDir,
#endif
                gloss, 
                specularity, 
                geometricNormal, 
                tbn, 
#if defined(LIT_IRIDESCENCE)
                iridescenceFresnel,
#endif
                clearcoat_worldNormal,
                clearcoat_gloss,
                sheen_gloss,
                iridescence_intensity
            ); 
        }
    }
}
`;
