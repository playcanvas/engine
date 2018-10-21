float _getShadowPCF5x5(sampler2DShadow shadowMap, vec3 shadowParams) {
    // http://the-witness.net/news/2013/09/shadow-mapping-summary-part-1/

    float z = dShadowCoord.z;
    vec2 uv = dShadowCoord.xy * shadowParams.x; // 1 unit - 1 texel
    float shadowMapSizeInv = 1.0 / shadowParams.x;
    vec2 base_uv = floor(uv + 0.5);
    float s = (uv.x + 0.5 - base_uv.x);
    float t = (uv.y + 0.5 - base_uv.y);
    base_uv -= vec2(0.5);
    base_uv *= shadowMapSizeInv;


    float uw0 = (4.0 - 3.0 * s);
    float uw1 = 7.0;
    float uw2 = (1.0 + 3.0 * s);

    float u0 = (3.0 - 2.0 * s) / uw0 - 2.0;
    float u1 = (3.0 + s) / uw1;
    float u2 = s / uw2 + 2.0;

    float vw0 = (4.0 - 3.0 * t);
    float vw1 = 7.0;
    float vw2 = (1.0 + 3.0 * t);

    float v0 = (3.0 - 2.0 * t) / vw0 - 2.0;
    float v1 = (3.0 + t) / vw1;
    float v2 = t / vw2 + 2.0;

    float sum = 0.0;

    u0 = u0 * shadowMapSizeInv + base_uv.x;
    v0 = v0 * shadowMapSizeInv + base_uv.y;

    u1 = u1 * shadowMapSizeInv + base_uv.x;
    v1 = v1 * shadowMapSizeInv + base_uv.y;

    u2 = u2 * shadowMapSizeInv + base_uv.x;
    v2 = v2 * shadowMapSizeInv + base_uv.y;

    sum += uw0 * vw0 * texture(shadowMap, vec3(u0, v0, z));
    sum += uw1 * vw0 * texture(shadowMap, vec3(u1, v0, z));
    sum += uw2 * vw0 * texture(shadowMap, vec3(u2, v0, z));

    sum += uw0 * vw1 * texture(shadowMap, vec3(u0, v1, z));
    sum += uw1 * vw1 * texture(shadowMap, vec3(u1, v1, z));
    sum += uw2 * vw1 * texture(shadowMap, vec3(u2, v1, z));

    sum += uw0 * vw2 * texture(shadowMap, vec3(u0, v2, z));
    sum += uw1 * vw2 * texture(shadowMap, vec3(u1, v2, z));
    sum += uw2 * vw2 * texture(shadowMap, vec3(u2, v2, z));

    sum *= 1.0f / 144.0;

    sum = gammaCorrectInput(sum); // gives softer gradient
    sum = saturate(sum);

    return sum;
}

float getShadowPCF5x5(sampler2DShadow shadowMap, vec3 shadowParams) {
    return _getShadowPCF5x5(shadowMap, shadowParams);
}

float getShadowSpotPCF5x5(sampler2DShadow shadowMap, vec4 shadowParams) {
    return _getShadowPCF5x5(shadowMap, shadowParams.xyz);
}
