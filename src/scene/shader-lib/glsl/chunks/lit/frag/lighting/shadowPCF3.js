export default /* glsl */`
// ----- Directional/Spot Sampling -----

float _getShadowPCF3x3(SHADOWMAP_ACCEPT(shadowMap), vec3 shadowCoord, vec3 shadowParams) {
    float z = shadowCoord.z;
    vec2 uv = shadowCoord.xy * shadowParams.x; // 1 unit - 1 texel
    float shadowMapSizeInv = 1.0 / shadowParams.x;
    vec2 base_uv = floor(uv + 0.5);
    float s = (uv.x + 0.5 - base_uv.x);
    float t = (uv.y + 0.5 - base_uv.y); 
    base_uv -= vec2(0.5);
    base_uv *= shadowMapSizeInv;

    float sum = 0.0;

    float uw0 = (3.0 - 2.0 * s);
    float uw1 = (1.0 + 2.0 * s);

    float u0 = (2.0 - s) / uw0 - 1.0;
    float u1 = s / uw1 + 1.0;

    float vw0 = (3.0 - 2.0 * t);
    float vw1 = (1.0 + 2.0 * t);

    float v0 = (2.0 - t) / vw0 - 1.0;
    float v1 = t / vw1 + 1.0;

    u0 = u0 * shadowMapSizeInv + base_uv.x;
    v0 = v0 * shadowMapSizeInv + base_uv.y;

    u1 = u1 * shadowMapSizeInv + base_uv.x;
    v1 = v1 * shadowMapSizeInv + base_uv.y;

    sum += uw0 * vw0 * textureShadow(shadowMap, vec3(u0, v0, z));
    sum += uw1 * vw0 * textureShadow(shadowMap, vec3(u1, v0, z));
    sum += uw0 * vw1 * textureShadow(shadowMap, vec3(u0, v1, z));
    sum += uw1 * vw1 * textureShadow(shadowMap, vec3(u1, v1, z));

    sum *= 1.0f / 16.0;
    return sum;
}

float getShadowPCF3x3(SHADOWMAP_ACCEPT(shadowMap), vec3 shadowCoord, vec4 shadowParams) {
    return _getShadowPCF3x3(SHADOWMAP_PASS(shadowMap), shadowCoord, shadowParams.xyz);
}

float getShadowSpotPCF3x3(SHADOWMAP_ACCEPT(shadowMap), vec3 shadowCoord, vec4 shadowParams) {
    return _getShadowPCF3x3(SHADOWMAP_PASS(shadowMap), shadowCoord, shadowParams.xyz);
}

// ----- Omni Sampling -----

#ifndef WEBGPU

float getShadowOmniPCF3x3(samplerCubeShadow shadowMap, vec4 shadowParams, vec3 dir) {
    
    // Calculate shadow depth from the light direction
    float shadowZ = length(dir) * shadowParams.w + shadowParams.z;

    // offset
    float z = 1.0 / float(textureSize(shadowMap, 0));
    vec3 tc = normalize(dir);

    // average 4 samples - not a strict 3x3 PCF but that's tricky with cubemaps
    mediump vec4 shadows;
    shadows.x = texture(shadowMap, vec4(tc + vec3( z, z, z), shadowZ));
    shadows.y = texture(shadowMap, vec4(tc + vec3(-z,-z, z), shadowZ));
    shadows.z = texture(shadowMap, vec4(tc + vec3(-z, z,-z), shadowZ));
    shadows.w = texture(shadowMap, vec4(tc + vec3( z,-z,-z), shadowZ));

    return dot(shadows, vec4(0.25));
}

float getShadowOmniPCF3x3(samplerCubeShadow shadowMap, vec3 shadowCoord, vec4 shadowParams, vec3 lightDir) {
    return getShadowOmniPCF3x3(shadowMap, shadowParams, lightDir);
}

#endif
`;
