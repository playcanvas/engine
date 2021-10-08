// Clustered Omni Sampling using atlas

#ifdef GL2

float getShadowOmniClusteredSingleSample(sampler2DShadow shadowMap, vec4 shadowParams, vec3 omniAtlasViewport, float shadowEdgePixels, vec3 dir) {

    float shadowTextureResolution = shadowParams.x;
    vec2 uv = getCubemapAtlasCoordinates(omniAtlasViewport, shadowEdgePixels, shadowTextureResolution, dir);

    float shadowZ = length(dir) * shadowParams.w + shadowParams.z;
    return texture(shadowMap, vec3(uv, shadowZ));
}


float getShadowOmniClusteredPCF3x3(sampler2DShadow shadowMap, vec4 shadowParams, vec3 omniAtlasViewport, float shadowEdgePixels, vec3 dir) {

    float shadowTextureResolution = shadowParams.x;
    vec2 uv = getCubemapAtlasCoordinates(omniAtlasViewport, shadowEdgePixels, shadowTextureResolution, dir);

    float shadowZ = length(dir) * shadowParams.w + shadowParams.z;
    dShadowCoord = vec3(uv, shadowZ);
    return getShadowPCF3x3(shadowMap, shadowParams.xyz);
}

#else

float getShadowOmniClusteredSingleSample(sampler2D shadowMap, vec4 shadowParams, vec3 omniAtlasViewport, float shadowEdgePixels, vec3 dir) {

    float shadowTextureResolution = shadowParams.x;
    vec2 uv = getCubemapAtlasCoordinates(omniAtlasViewport, shadowEdgePixels, shadowTextureResolution, dir);

    // no filter shadow sampling
    float depth = unpackFloat(texture2D(shadowMap, uv));
    float shadowZ = length(dir) * shadowParams.w + shadowParams.z;
    return depth > shadowZ ? 1.0 : 0.0;
}

float getShadowOmniClusteredPCF3x3(sampler2D shadowMap, vec4 shadowParams, vec3 omniAtlasViewport, float shadowEdgePixels, vec3 dir) {

    float shadowTextureResolution = shadowParams.x;
    vec2 uv = getCubemapAtlasCoordinates(omniAtlasViewport, shadowEdgePixels, shadowTextureResolution, dir);

    // pcf3
    float shadowZ = length(dir) * shadowParams.w + shadowParams.z;
    dShadowCoord = vec3(uv, shadowZ);
    return getShadowPCF3x3(shadowMap, shadowParams.xyz);
}

#endif
