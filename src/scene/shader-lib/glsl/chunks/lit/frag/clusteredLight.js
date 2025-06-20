export default /* glsl */`

#include "lightBufferDefinesPS"

// include this before shadow / cookie code
#include "clusteredLightUtilsPS"

#ifdef CLUSTER_COOKIES
    #include "clusteredLightCookiesPS"
#endif

#ifdef CLUSTER_SHADOWS
    #include "clusteredLightShadowsPS"
#endif

uniform highp sampler2D clusterWorldTexture;
uniform highp sampler2D lightsTexture;

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
uniform vec2 shadowAtlasParams;

// structure storing light properties of a clustered light
// it's sorted to have all vectors aligned to 4 floats to limit padding
struct ClusterLightData {

    // 32bit of flags
    uint flags;

    // area light sizes / orientation
    vec3 halfWidth;

    bool isSpot;

    // area light sizes / orientation
    vec3 halfHeight;

    // light index
    int lightIndex;

    // world space position
    vec3 position;

    // area light shape
    uint shape;

    // world space direction (spot light only)
    vec3 direction;

    // light follow mode
    bool falloffModeLinear;

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

    // compressed biases, two haf-floats stored in a float
    float biasesData;

    // shadow bias values
    float shadowBias;
    float shadowNormalBias;

    // compressed angles, two haf-floats stored in a float
    float anglesData;

    // spot light inner and outer angle cosine
    float innerConeAngleCos;
    float outerConeAngleCos;

    // intensity of the cookie
    float cookieIntensity;

    // light mask
    //float mask;
    bool isDynamic;
    bool isLightmapped;
};

// Note: on some devices (tested on Pixel 3A XL), this matrix when stored inside the light struct has lower precision compared to
// when stored outside, so we store it outside to avoid spot shadow flickering. This might need to be done to other / all members
// of the structure if further similar issues are observed.

// shadow (spot light only) / cookie projection matrix
mat4 lightProjectionMatrix;

vec4 sampleLightTextureF(const ClusterLightData clusterLightData, int index) {
    return texelFetch(lightsTexture, ivec2(index, clusterLightData.lightIndex), 0);
}

void decodeClusterLightCore(inout ClusterLightData clusterLightData, float lightIndex) {

    // light index
    clusterLightData.lightIndex = int(lightIndex);

    // sample data encoding half-float values into 32bit uints
    vec4 halfData = sampleLightTextureF(clusterLightData, {CLUSTER_TEXTURE_COLOR_ANGLES_BIAS});

    // store floats we decode later as needed
    clusterLightData.anglesData = halfData.z;
    clusterLightData.biasesData = halfData.w;

    // decompress color half-floats
    vec2 colorRG = unpackHalf2x16(floatBitsToUint(halfData.x));
    vec2 colorB_ = unpackHalf2x16(floatBitsToUint(halfData.y));
    clusterLightData.color = vec3(colorRG, colorB_.x) * {LIGHT_COLOR_DIVIDER};

    // position and range, full floats
    vec4 lightPosRange = sampleLightTextureF(clusterLightData, {CLUSTER_TEXTURE_POSITION_RANGE});
    clusterLightData.position = lightPosRange.xyz;
    clusterLightData.range = lightPosRange.w;

    // spot direction & flags data
    vec4 lightDir_Flags = sampleLightTextureF(clusterLightData, {CLUSTER_TEXTURE_DIRECTION_FLAGS});

    // spot light direction
    clusterLightData.direction = lightDir_Flags.xyz;

    // 32bit flags
    clusterLightData.flags = floatBitsToUint(lightDir_Flags.w);
    clusterLightData.isSpot = (clusterLightData.flags & (1u << 30u)) != 0u;
    clusterLightData.shape = (clusterLightData.flags >> 28u) & 0x3u;
    clusterLightData.falloffModeLinear = (clusterLightData.flags & (1u << 27u)) == 0u;
    clusterLightData.shadowIntensity = float((clusterLightData.flags >> 0u) & 0xFFu) / 255.0;
    clusterLightData.cookieIntensity = float((clusterLightData.flags >> 8u) & 0xFFu) / 255.0;
    clusterLightData.isDynamic = (clusterLightData.flags & (1u << 22u)) != 0u;
    clusterLightData.isLightmapped = (clusterLightData.flags & (1u << 21u)) != 0u;
}

void decodeClusterLightSpot(inout ClusterLightData clusterLightData) {

    // spot light cos angles
    vec2 angles = unpackHalf2x16(floatBitsToUint(clusterLightData.anglesData));
    clusterLightData.innerConeAngleCos = angles.x;
    clusterLightData.outerConeAngleCos = angles.y;
}

void decodeClusterLightOmniAtlasViewport(inout ClusterLightData clusterLightData) {
    clusterLightData.omniAtlasViewport = sampleLightTextureF(clusterLightData, {CLUSTER_TEXTURE_PROJ_MAT_0}).xyz;
}

void decodeClusterLightAreaData(inout ClusterLightData clusterLightData) {
    clusterLightData.halfWidth = sampleLightTextureF(clusterLightData, {CLUSTER_TEXTURE_AREA_DATA_WIDTH}).xyz;
    clusterLightData.halfHeight = sampleLightTextureF(clusterLightData, {CLUSTER_TEXTURE_AREA_DATA_HEIGHT}).xyz;
}

void decodeClusterLightProjectionMatrixData(inout ClusterLightData clusterLightData) {
    
    // shadow matrix
    vec4 m0 = sampleLightTextureF(clusterLightData, {CLUSTER_TEXTURE_PROJ_MAT_0});
    vec4 m1 = sampleLightTextureF(clusterLightData, {CLUSTER_TEXTURE_PROJ_MAT_1});
    vec4 m2 = sampleLightTextureF(clusterLightData, {CLUSTER_TEXTURE_PROJ_MAT_2});
    vec4 m3 = sampleLightTextureF(clusterLightData, {CLUSTER_TEXTURE_PROJ_MAT_3});
    lightProjectionMatrix = mat4(m0, m1, m2, m3);
}

void decodeClusterLightShadowData(inout ClusterLightData clusterLightData) {
    
    // shadow biases
    vec2 biases = unpackHalf2x16(floatBitsToUint(clusterLightData.biasesData));
    clusterLightData.shadowBias = biases.x;
    clusterLightData.shadowNormalBias = biases.y;
}

void decodeClusterLightCookieData(inout ClusterLightData clusterLightData) {

    // extract channel mask from flags
    uint cookieFlags = (clusterLightData.flags >> 23u) & 0x0Fu;  // 4bits, each bit enables a channel
    clusterLightData.cookieChannelMask = vec4(uvec4(cookieFlags) & uvec4(1u, 2u, 4u, 8u));
    clusterLightData.cookieChannelMask = step(1.0, clusterLightData.cookieChannelMask);  // Normalize to 0.0 or 1.0
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
    vec3 lightDirW = evalOmniLight(light.position);
    vec3 lightDirNormW = normalize(lightDirW);

    #ifdef CLUSTER_AREALIGHTS

    // distance attenuation
    if (light.shape != {LIGHTSHAPE_PUNCTUAL}) { // area light

        // area lights
        decodeClusterLightAreaData(light);

        // handle light shape
        if (light.shape == {LIGHTSHAPE_RECT}) {
            calcRectLightValues(light.position, light.halfWidth, light.halfHeight);
        } else if (light.shape == {LIGHTSHAPE_DISK}) {
            calcDiskLightValues(light.position, light.halfWidth, light.halfHeight);
        } else { // sphere
            calcSphereLightValues(light.position, light.halfWidth, light.halfHeight);
        }

        falloffAttenuation = getFalloffWindow(light.range, lightDirW);

    } else

    #endif

    {   // punctual light

        if (light.falloffModeLinear)
            falloffAttenuation = getFalloffLinear(light.range, lightDirW);
        else
            falloffAttenuation = getFalloffInvSquared(light.range, lightDirW);
    }

    if (falloffAttenuation > 0.00001) {

        #ifdef CLUSTER_AREALIGHTS

        if (light.shape != {LIGHTSHAPE_PUNCTUAL}) { // area light

            // handle light shape
            if (light.shape == {LIGHTSHAPE_RECT}) {
                diffuseAttenuation = getRectLightDiffuse(worldNormal, viewDir, lightDirW, lightDirNormW) * 16.0;
            } else if (light.shape == {LIGHTSHAPE_DISK}) {
                diffuseAttenuation = getDiskLightDiffuse(worldNormal, viewDir, lightDirW, lightDirNormW) * 16.0;
            } else { // sphere
                diffuseAttenuation = getSphereLightDiffuse(worldNormal, viewDir, lightDirW, lightDirNormW) * 16.0;
            }

        } else

        #endif

        {
            falloffAttenuation *= getLightDiffuse(worldNormal, viewDir, lightDirNormW); 
        }

        // spot light falloff
        if (light.isSpot) {
            decodeClusterLightSpot(light);
            falloffAttenuation *= getSpotEffect(light.direction, light.innerConeAngleCos, light.outerConeAngleCos, lightDirNormW);
        }

        #if defined(CLUSTER_COOKIES) || defined(CLUSTER_SHADOWS)

        if (falloffAttenuation > 0.00001) {

            // shadow / cookie
            if (light.shadowIntensity > 0.0 || light.cookieIntensity > 0.0) {

                // shared shadow / cookie data depends on light type
                if (light.isSpot) {
                    decodeClusterLightProjectionMatrixData(light);
                } else {
                    decodeClusterLightOmniAtlasViewport(light);
                }

                float shadowTextureResolution = shadowAtlasParams.x;
                float shadowEdgePixels = shadowAtlasParams.y;

                #ifdef CLUSTER_COOKIES

                // cookie
                if (light.cookieIntensity > 0.0) {
                    decodeClusterLightCookieData(light);

                    if (light.isSpot) {
                        cookieAttenuation = getCookie2DClustered(TEXTURE_PASS(cookieAtlasTexture), lightProjectionMatrix, vPositionW, light.cookieIntensity, light.cookieChannelMask);
                    } else {
                        cookieAttenuation = getCookieCubeClustered(TEXTURE_PASS(cookieAtlasTexture), lightDirW, light.cookieIntensity, light.cookieChannelMask, shadowTextureResolution, shadowEdgePixels, light.omniAtlasViewport);
                    }
                }

                #endif

                #ifdef CLUSTER_SHADOWS

                // shadow
                if (light.shadowIntensity > 0.0) {
                    decodeClusterLightShadowData(light);

                    vec4 shadowParams = vec4(shadowTextureResolution, light.shadowNormalBias, light.shadowBias, 1.0 / light.range);

                    if (light.isSpot) {

                        // spot shadow
                        vec3 shadowCoord = getShadowCoordPerspZbufferNormalOffset(lightProjectionMatrix, shadowParams, geometricNormal);
                        
                        #if defined(CLUSTER_SHADOW_TYPE_PCF1)
                            float shadow = getShadowSpotClusteredPCF1(SHADOWMAP_PASS(shadowAtlasTexture), shadowCoord, shadowParams);
                        #elif defined(CLUSTER_SHADOW_TYPE_PCF3)
                            float shadow = getShadowSpotClusteredPCF3(SHADOWMAP_PASS(shadowAtlasTexture), shadowCoord, shadowParams);
                        #elif defined(CLUSTER_SHADOW_TYPE_PCF5)
                            float shadow = getShadowSpotClusteredPCF5(SHADOWMAP_PASS(shadowAtlasTexture), shadowCoord, shadowParams);
                        #elif defined(CLUSTER_SHADOW_TYPE_PCSS)
                            float shadow = getShadowSpotClusteredPCSS(SHADOWMAP_PASS(shadowAtlasTexture), shadowCoord, shadowParams);
                        #endif
                        falloffAttenuation *= mix(1.0, shadow, light.shadowIntensity);

                    } else {

                        // omni shadow
                        vec3 dir = normalOffsetPointShadow(shadowParams, light.position, lightDirW, lightDirNormW, geometricNormal);  // normalBias adjusted for distance

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

        if (light.shape != {LIGHTSHAPE_PUNCTUAL}) { // area light

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

                if (light.shape == {LIGHTSHAPE_RECT}) {
                    areaLightSpecular = getRectLightSpecular(worldNormal, viewDir);
                } else if (light.shape == {LIGHTSHAPE_DISK}) {
                    areaLightSpecular = getDiskLightSpecular(worldNormal, viewDir);
                } else { // sphere
                    areaLightSpecular = getSphereLightSpecular(worldNormal, viewDir);
                }

                dSpecularLight += dLTCSpecFres * areaLightSpecular * falloffAttenuation * light.color * cookieAttenuation;

                #ifdef LIT_CLEARCOAT

                    // area light specular clear coat
                    float areaLightSpecularCC;

                    if (light.shape == {LIGHTSHAPE_RECT}) {
                        areaLightSpecularCC = getRectLightSpecular(clearcoat_worldNormal, viewDir);
                    } else if (light.shape == {LIGHTSHAPE_DISK}) {
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

                vec3 halfDir = normalize(-lightDirNormW + viewDir);
                
                // specular
                #ifdef LIT_SPECULAR_FRESNEL
                    dSpecularLight += 
                        getLightSpecular(halfDir, reflectionDir, worldNormal, viewDir, lightDirNormW, gloss, tbn) * falloffAttenuation * light.color * cookieAttenuation * 
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
                    dSpecularLight += getLightSpecular(halfDir, reflectionDir, worldNormal, viewDir, lightDirNormW, gloss, tbn) * falloffAttenuation * light.color * cookieAttenuation * specularity;
                #endif

                #ifdef LIT_CLEARCOAT
                    #ifdef LIT_SPECULAR_FRESNEL
                        ccSpecularLight += getLightSpecular(halfDir, clearcoatReflectionDir, clearcoat_worldNormal, viewDir, lightDirNormW, clearcoat_gloss, tbn) * falloffAttenuation * light.color * cookieAttenuation * getFresnelCC(dot(viewDir, halfDir));
                    #else
                        ccSpecularLight += getLightSpecular(halfDir, clearcoatReflectionDir, clearcoat_worldNormal, viewDir, lightDirNormW, clearcoat_gloss, tbn) * falloffAttenuation * light.color * cookieAttenuation; 
                    #endif
                #endif

                #ifdef LIT_SHEEN
                    sSpecularLight += getLightSpecularSheen(halfDir, worldNormal, viewDir, lightDirNormW, sheen_gloss) * falloffAttenuation * light.color * cookieAttenuation;
                #endif

            #endif
        }
    }

    // Write to global attenuation values (for lightmapper)
    dAtten = falloffAttenuation;
    dLightDirNormW = lightDirNormW;
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
    #ifdef CLUSTER_MESH_DYNAMIC_LIGHTS
        bool acceptLightMask = clusterLightData.isDynamic;
    #else
        bool acceptLightMask = clusterLightData.isLightmapped;
    #endif

    if (acceptLightMask)
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

            // using a single channel texture with data in red channel
            float lightIndex = texelFetch(clusterWorldTexture, ivec2(int(clusterU) + lightCellIndex, clusterV), 0).x;

            if (lightIndex <= 0.0)
                break;

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
