// Clustered Omni Sampling using atlas
export default /* wgsl */`

fn _getShadowCoordPerspZbuffer(shadowMatrix: mat4x4f, shadowParams: vec4f, wPos: vec3f) -> vec3f {
    var projPos = shadowMatrix * vec4f(wPos, 1.0);
    return projPos.xyz / projPos.w;
    // depth bias is already applied on render
}

fn getShadowCoordPerspZbufferNormalOffset(shadowMatrix: mat4x4f, shadowParams: vec4f, normal: vec3f) -> vec3f {
    let wPos: vec3f = vPositionW + normal * shadowParams.y;
    return _getShadowCoordPerspZbuffer(shadowMatrix, shadowParams, wPos);
}

fn normalOffsetPointShadow(shadowParams: vec4f, lightPos: vec3f, lightDir: vec3f, lightDirNorm: vec3f, normal: vec3f) -> vec3f {
    let distScale: f32 = length(lightDir);
    let wPos: vec3f = vPositionW + normal * shadowParams.y * clamp(1.0 - dot(normal, -lightDirNorm), 0.0, 1.0) * distScale; //0.02
    let dir: vec3f = wPos - lightPos;
    return dir;
}

#if defined(CLUSTER_SHADOW_TYPE_PCF1)

    fn getShadowOmniClusteredPCF1(shadowMap: texture_depth_2d, shadowMapSampler: sampler_comparison, shadowParams: vec4f, omniAtlasViewport: vec3f, shadowEdgePixels: f32, lightDir: vec3f) -> f32 {

        let shadowTextureResolution: f32 = shadowParams.x;
        let uv: vec2f = getCubemapAtlasCoordinates(omniAtlasViewport, shadowEdgePixels, shadowTextureResolution, lightDir);

        let shadowZ: f32 = length(lightDir) * shadowParams.w + shadowParams.z;
        return textureSampleCompareLevel(shadowMap, shadowMapSampler, uv, shadowZ);
    }

#endif

#if defined(CLUSTER_SHADOW_TYPE_PCF3)

    fn getShadowOmniClusteredPCF3(shadowMap: texture_depth_2d, shadowMapSampler: sampler_comparison, shadowParams: vec4f, omniAtlasViewport: vec3f, shadowEdgePixels: f32, lightDir: vec3f) -> f32 {

        let shadowTextureResolution: f32 = shadowParams.x;
        let uv: vec2f = getCubemapAtlasCoordinates(omniAtlasViewport, shadowEdgePixels, shadowTextureResolution, lightDir);

        let shadowZ: f32 = length(lightDir) * shadowParams.w + shadowParams.z;
        let shadowCoord: vec3f = vec3f(uv, shadowZ);
        return getShadowPCF3x3(shadowMap, shadowMapSampler, shadowCoord, shadowParams);
    }

#endif

#if defined(CLUSTER_SHADOW_TYPE_PCF5)

    fn getShadowOmniClusteredPCF5(shadowMap: texture_depth_2d, shadowMapSampler: sampler_comparison, shadowParams: vec4f, omniAtlasViewport: vec3f, shadowEdgePixels: f32, lightDir: vec3f) -> f32 {

        let shadowTextureResolution: f32 = shadowParams.x;
        let uv: vec2f = getCubemapAtlasCoordinates(omniAtlasViewport, shadowEdgePixels, shadowTextureResolution, lightDir);

        let shadowZ: f32 = length(lightDir) * shadowParams.w + shadowParams.z;
        let shadowCoord: vec3f = vec3f(uv, shadowZ);
        return getShadowPCF5x5(shadowMap, shadowMapSampler, shadowCoord, shadowParams);
    }

#endif

// Clustered Spot Sampling using atlas

#if defined(CLUSTER_SHADOW_TYPE_PCF1)

    fn getShadowSpotClusteredPCF1(shadowMap: texture_depth_2d, shadowMapSampler: sampler_comparison, shadowCoord: vec3f, shadowParams: vec4f) -> f32 {
        return textureSampleCompareLevel(shadowMap, shadowMapSampler, shadowCoord.xy, shadowCoord.z);
    }

#endif

    #if defined(CLUSTER_SHADOW_TYPE_PCF3)

    fn getShadowSpotClusteredPCF3(shadowMap: texture_depth_2d, shadowMapSampler: sampler_comparison, shadowCoord: vec3f, shadowParams: vec4f) -> f32 {
        return getShadowSpotPCF3x3(shadowMap, shadowMapSampler, shadowCoord, shadowParams);
    }

#endif

    #if defined(CLUSTER_SHADOW_TYPE_PCF5)

    fn getShadowSpotClusteredPCF5(shadowMap: texture_depth_2d, shadowMapSampler: sampler_comparison, shadowCoord: vec3f, shadowParams: vec4f) -> f32 {
        return getShadowPCF5x5(shadowMap, shadowMapSampler, shadowCoord, shadowParams);
    }

#endif
`;
