// Clustered Omni Sampling using atlas
export default /* glsl */`

vec3 _getShadowCoordPerspZbuffer(mat4 shadowMatrix, vec4 shadowParams, vec3 wPos) {
    vec4 projPos = shadowMatrix * vec4(wPos, 1.0);
    projPos.xyz /= projPos.w;
    return projPos.xyz;
    // depth bias is already applied on render
}

vec3 getShadowCoordPerspZbufferNormalOffset(mat4 shadowMatrix, vec4 shadowParams, vec3 normal) {
    vec3 wPos = vPositionW + normal * shadowParams.y;
    return _getShadowCoordPerspZbuffer(shadowMatrix, shadowParams, wPos);
}

vec3 normalOffsetPointShadow(vec4 shadowParams, vec3 lightPos, vec3 lightDir, vec3 lightDirNorm, vec3 normal) {
    float distScale = length(lightDir);
    vec3 wPos = vPositionW + normal * shadowParams.y * clamp(1.0 - dot(normal, -lightDirNorm), 0.0, 1.0) * distScale; //0.02
    vec3 dir = wPos - lightPos;
    return dir;
}

#if defined(CLUSTER_SHADOW_TYPE_PCF1)

float getShadowOmniClusteredPCF1(SHADOWMAP_ACCEPT(shadowMap), vec4 shadowParams, vec3 omniAtlasViewport, float shadowEdgePixels, vec3 lightDir) {

    float shadowTextureResolution = shadowParams.x;
    vec2 uv = getCubemapAtlasCoordinates(omniAtlasViewport, shadowEdgePixels, shadowTextureResolution, lightDir);

    float shadowZ = length(lightDir) * shadowParams.w + shadowParams.z;
    return textureShadow(shadowMap, vec3(uv, shadowZ));
}

#endif

#if defined(CLUSTER_SHADOW_TYPE_PCF3)

float getShadowOmniClusteredPCF3(SHADOWMAP_ACCEPT(shadowMap), vec4 shadowParams, vec3 omniAtlasViewport, float shadowEdgePixels, vec3 lightDir) {

    float shadowTextureResolution = shadowParams.x;
    vec2 uv = getCubemapAtlasCoordinates(omniAtlasViewport, shadowEdgePixels, shadowTextureResolution, lightDir);

    float shadowZ = length(lightDir) * shadowParams.w + shadowParams.z;
    vec3 shadowCoord = vec3(uv, shadowZ);
    return getShadowPCF3x3(SHADOWMAP_PASS(shadowMap), shadowCoord, shadowParams);
}

#endif

#if defined(CLUSTER_SHADOW_TYPE_PCF5)

float getShadowOmniClusteredPCF5(SHADOWMAP_ACCEPT(shadowMap), vec4 shadowParams, vec3 omniAtlasViewport, float shadowEdgePixels, vec3 lightDir) {

    float shadowTextureResolution = shadowParams.x;
    vec2 uv = getCubemapAtlasCoordinates(omniAtlasViewport, shadowEdgePixels, shadowTextureResolution, lightDir);

    float shadowZ = length(lightDir) * shadowParams.w + shadowParams.z;
    vec3 shadowCoord = vec3(uv, shadowZ);
    return getShadowPCF5x5(SHADOWMAP_PASS(shadowMap), shadowCoord, shadowParams);
}

#endif

// Clustered Spot Sampling using atlas

#if defined(CLUSTER_SHADOW_TYPE_PCF1)

float getShadowSpotClusteredPCF1(SHADOWMAP_ACCEPT(shadowMap), vec3 shadowCoord, vec4 shadowParams) {
    return textureShadow(shadowMap, shadowCoord);
}

#endif

#if defined(CLUSTER_SHADOW_TYPE_PCF3)

float getShadowSpotClusteredPCF3(SHADOWMAP_ACCEPT(shadowMap), vec3 shadowCoord, vec4 shadowParams) {
    return getShadowSpotPCF3x3(SHADOWMAP_PASS(shadowMap), shadowCoord, shadowParams);
}

#endif

#if defined(CLUSTER_SHADOW_TYPE_PCF5)

float getShadowSpotClusteredPCF5(SHADOWMAP_ACCEPT(shadowMap), vec3 shadowCoord, vec4 shadowParams) {
    return getShadowPCF5x5(SHADOWMAP_PASS(shadowMap), shadowCoord, shadowParams);
}
#endif
`;
