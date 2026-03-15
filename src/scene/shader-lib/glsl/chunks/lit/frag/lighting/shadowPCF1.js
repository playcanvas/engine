export default /* glsl */`
// ----- Directional/Spot Sampling -----

float getShadowPCF1x1(SHADOWMAP_ACCEPT(shadowMap), vec3 shadowCoord, vec4 shadowParams) {
    return textureShadow(shadowMap, shadowCoord);
}

float getShadowSpotPCF1x1(SHADOWMAP_ACCEPT(shadowMap), vec3 shadowCoord, vec4 shadowParams) {
    return textureShadow(shadowMap, shadowCoord);
}

// ----- Omni Sampling -----

#ifndef WEBGPU

float getShadowOmniPCF1x1(samplerCubeShadow shadowMap, vec3 shadowCoord, vec4 shadowParams, vec3 lightDir) {
    float shadowZ = length(lightDir) * shadowParams.w + shadowParams.z;
    return texture(shadowMap, vec4(lightDir, shadowZ));
}

#endif
`;
