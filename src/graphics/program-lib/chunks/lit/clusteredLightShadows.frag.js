export default /* glsl */`
// Clustered Omni Sampling using atlas

#ifdef GL2

    #if defined(CLUSTER_SHADOW_TYPE_PCF1)

    float getShadowOmniClusteredPCF1(sampler2DShadow shadowMap, vec4 shadowParams, vec3 omniAtlasViewport, float shadowEdgePixels, vec3 dir) {

        float shadowTextureResolution = shadowParams.x;
        vec2 uv = getCubemapAtlasCoordinates(omniAtlasViewport, shadowEdgePixels, shadowTextureResolution, dir);

        float shadowZ = length(dir) * shadowParams.w + shadowParams.z;
        return texture(shadowMap, vec3(uv, shadowZ));
    }

    #endif

    #if defined(CLUSTER_SHADOW_TYPE_PCF3)

    float getShadowOmniClusteredPCF3(sampler2DShadow shadowMap, vec4 shadowParams, vec3 omniAtlasViewport, float shadowEdgePixels, vec3 dir) {

        float shadowTextureResolution = shadowParams.x;
        vec2 uv = getCubemapAtlasCoordinates(omniAtlasViewport, shadowEdgePixels, shadowTextureResolution, dir);

        float shadowZ = length(dir) * shadowParams.w + shadowParams.z;
        dShadowCoord = vec3(uv, shadowZ);
        return getShadowPCF3x3(shadowMap, shadowParams.xyz);
    }

    #endif

    #if defined(CLUSTER_SHADOW_TYPE_PCF5)

    float getShadowOmniClusteredPCF5(sampler2DShadow shadowMap, vec4 shadowParams, vec3 omniAtlasViewport, float shadowEdgePixels, vec3 dir) {

        float shadowTextureResolution = shadowParams.x;
        vec2 uv = getCubemapAtlasCoordinates(omniAtlasViewport, shadowEdgePixels, shadowTextureResolution, dir);

        float shadowZ = length(dir) * shadowParams.w + shadowParams.z;
        dShadowCoord = vec3(uv, shadowZ);
        return getShadowPCF5x5(shadowMap, shadowParams.xyz);
    }

    #endif

#else

    #if defined(CLUSTER_SHADOW_TYPE_PCF1)

    float getShadowOmniClusteredPCF1(sampler2D shadowMap, vec4 shadowParams, vec3 omniAtlasViewport, float shadowEdgePixels, vec3 dir) {

        float shadowTextureResolution = shadowParams.x;
        vec2 uv = getCubemapAtlasCoordinates(omniAtlasViewport, shadowEdgePixels, shadowTextureResolution, dir);

        // no filter shadow sampling
        float depth = unpackFloat(texture2D(shadowMap, uv));
        float shadowZ = length(dir) * shadowParams.w + shadowParams.z;
        return depth > shadowZ ? 1.0 : 0.0;
    }

    #endif

    #if defined(CLUSTER_SHADOW_TYPE_PCF3) || defined(CLUSTER_SHADOW_TYPE_PCF5)

    float getShadowOmniClusteredPCF3(sampler2D shadowMap, vec4 shadowParams, vec3 omniAtlasViewport, float shadowEdgePixels, vec3 dir) {

        float shadowTextureResolution = shadowParams.x;
        vec2 uv = getCubemapAtlasCoordinates(omniAtlasViewport, shadowEdgePixels, shadowTextureResolution, dir);

        // pcf3
        float shadowZ = length(dir) * shadowParams.w + shadowParams.z;
        dShadowCoord = vec3(uv, shadowZ);
        return getShadowPCF3x3(shadowMap, shadowParams.xyz);
    }

    #endif

    #if defined(CLUSTER_SHADOW_TYPE_PCF5)

    // we don't have PCF5 implementation for webgl1, use PCF3
    float getShadowOmniClusteredPCF5(sampler2D shadowMap, vec4 shadowParams, vec3 omniAtlasViewport, float shadowEdgePixels, vec3 dir) {
        return getShadowOmniClusteredPCF3(shadowMap, shadowParams, omniAtlasViewport, shadowEdgePixels, dir);
    }

    #endif

#endif


// Clustered Spot Sampling using atlas

#ifdef GL2

    #if defined(CLUSTER_SHADOW_TYPE_PCF1)

    float getShadowSpotClusteredPCF1(sampler2DShadow shadowMap, vec4 shadowParams) {
        return texture(shadowMap, dShadowCoord);
    }

    #endif

    #if defined(CLUSTER_SHADOW_TYPE_PCF3)

    float getShadowSpotClusteredPCF3(sampler2DShadow shadowMap, vec4 shadowParams) {
        return getShadowSpotPCF3x3(shadowMap, shadowParams);
    }

    #endif

    #if defined(CLUSTER_SHADOW_TYPE_PCF5)

    float getShadowSpotClusteredPCF5(sampler2DShadow shadowMap, vec4 shadowParams) {
        return getShadowPCF5x5(shadowMap, shadowParams.xyz);
    }
    #endif

#else

    #if defined(CLUSTER_SHADOW_TYPE_PCF1)

    float getShadowSpotClusteredPCF1(sampler2D shadowMap, vec4 shadowParams) {

        float depth = unpackFloat(texture2D(shadowMap, dShadowCoord.xy));

        return depth > dShadowCoord.z ? 1.0 : 0.0;

    }

    #endif

    #if defined(CLUSTER_SHADOW_TYPE_PCF3) || defined(CLUSTER_SHADOW_TYPE_PCF5)

    float getShadowSpotClusteredPCF3(sampler2D shadowMap, vec4 shadowParams) {
        return getShadowSpotPCF3x3(shadowMap, shadowParams);
    }

    #endif

    #if defined(CLUSTER_SHADOW_TYPE_PCF5)

    // we don't have PCF5 implementation for webgl1, use PCF3
    float getShadowSpotClusteredPCF5(sampler2D shadowMap, vec4 shadowParams) {
        return getShadowSpotClusteredPCF3(shadowMap, shadowParams);
    }

    #endif

#endif
`;
