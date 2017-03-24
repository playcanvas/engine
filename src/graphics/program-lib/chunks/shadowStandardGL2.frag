float do_pcf_sample(sampler2DShadow shadowMap, vec2 baseUv, float u, float v, float z) {
    return texture(shadowMap, vec3(baseUv.x + u, baseUv.y + v, z));
}

float _getShadowPCF5x5(sampler2DShadow shadowMap, vec3 shadowParams) {
    vec3 shadowCoord = dShadowCoord;

    float xoffset = 1.0 / shadowParams.x; // 1/shadow map width
    float dx0 = -xoffset;
    float dx1 = xoffset;
    float z = shadowCoord.z;

    vec2 uv = shadowCoord.xy * shadowParams.x; // 1 unit - 1 texel
    float shadowMapSizeInv = 1.0 / shadowParams.x;
    vec2 base_uv;
    base_uv.x = floor(uv.x + 0.5);
    base_uv.y = floor(uv.y + 0.5);
    float s = (uv.x + 0.5 - base_uv.x);
    float t = (uv.y + 0.5 - base_uv.y);
    base_uv -= vec2(0.5, 0.5);
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

    u0 *= shadowMapSizeInv;
    v0 *= shadowMapSizeInv;

    u1 *= shadowMapSizeInv;
    v1 *= shadowMapSizeInv;

    u2 *= shadowMapSizeInv;
    v2 *= shadowMapSizeInv;

    sum += uw0 * vw0 * do_pcf_sample(shadowMap, base_uv, u0, v0, z);
    sum += uw1 * vw0 * do_pcf_sample(shadowMap, base_uv, u1, v0, z);
    sum += uw2 * vw0 * do_pcf_sample(shadowMap, base_uv, u2, v0, z);

    sum += uw0 * vw1 * do_pcf_sample(shadowMap, base_uv, u0, v1, z);
    sum += uw1 * vw1 * do_pcf_sample(shadowMap, base_uv, u1, v1, z);
    sum += uw2 * vw1 * do_pcf_sample(shadowMap, base_uv, u2, v1, z);

    sum += uw0 * vw2 * do_pcf_sample(shadowMap, base_uv, u0, v2, z);
    sum += uw1 * vw2 * do_pcf_sample(shadowMap, base_uv, u1, v2, z);
    sum += uw2 * vw2 * do_pcf_sample(shadowMap, base_uv, u2, v2, z);

    sum *= 1.0f / 144.0;

    sum = gammaCorrectInput(sum);

    return sum;
}

float getShadowPCF5x5(sampler2DShadow shadowMap, vec3 shadowParams) {
    return _getShadowPCF5x5(shadowMap, shadowParams);
}

float getShadowSpotPCF5x5(sampler2DShadow shadowMap, vec4 shadowParams) {
    return _getShadowPCF5x5(shadowMap, shadowParams.xyz);
}
