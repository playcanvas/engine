float texture2Dshadow(sampler2DShadow shadowMap, vec3 uv) {
    return texture(shadowMap, uv);
}

float do_pcf_sample(sampler2DShadow shadowMap, vec2 baseUv, float u, float v, float z) {
    return texture(shadowMap, vec3(baseUv.x + u, baseUv.y + v, z));
}

float textureCubeShadow(samplerCubeShadow shadowMap, vec4 uv) {
    return texture(shadowMap, uv);
}

vec3 lessThan2(vec3 a, vec3 b) {
    return clamp((b - a)*1000.0, 0.0, 1.0); // softer version
}

// ----- Direct/Spot Sampling -----

float getShadowHard(sampler2DShadow shadowMap, vec3 shadowParams) {
    return texture2Dshadow(shadowMap, dShadowCoord.xyz);
}

float getShadowSpotHard(sampler2DShadow shadowMap, vec4 shadowParams) {
    float z = length(dLightDirW) * shadowParams.w + shadowParams.z;
    return texture2Dshadow(shadowMap, vec3(dShadowCoord.xy, z));
}

/*float _xgetShadowPCF3x3(mat3 depthKernel, sampler2DShadow shadowMap, vec3 shadowParams) {
    mat3 shadowKernel;
    vec3 shadowCoord = dShadowCoord;
    vec3 shadowZ = vec3(shadowCoord.z);
    shadowKernel[0] = vec3(greaterThan(depthKernel[0], shadowZ));
    shadowKernel[1] = vec3(greaterThan(depthKernel[1], shadowZ));
    shadowKernel[2] = vec3(greaterThan(depthKernel[2], shadowZ));

    vec2 fractionalCoord = fract( shadowCoord.xy * shadowParams.x );

    shadowKernel[0] = mix(shadowKernel[0], shadowKernel[1], fractionalCoord.x);
    shadowKernel[1] = mix(shadowKernel[1], shadowKernel[2], fractionalCoord.x);

    vec4 shadowValues;
    shadowValues.x = mix(shadowKernel[0][0], shadowKernel[0][1], fractionalCoord.y);
    shadowValues.y = mix(shadowKernel[0][1], shadowKernel[0][2], fractionalCoord.y);
    shadowValues.z = mix(shadowKernel[1][0], shadowKernel[1][1], fractionalCoord.y);
    shadowValues.w = mix(shadowKernel[1][1], shadowKernel[1][2], fractionalCoord.y);

    return dot( shadowValues, vec4( 1.0 ) ) * 0.25;
}*/

float _getShadowPCF3x3(sampler2DShadow shadowMap, vec3 shadowParams) {
    vec3 shadowCoord = dShadowCoord;

    float xoffset = 1.0 / shadowParams.x; // 1/shadow map width
    float dx0 = -xoffset;
    float dx1 = xoffset;

    /*mat3 depthKernel;
    depthKernel[0][0] = texture2Dshadow(shadowMap, shadowCoord.xy + vec2(dx0, dx0));
    depthKernel[0][1] = texture2Dshadow(shadowMap, shadowCoord.xy + vec2(dx0, 0.0));
    depthKernel[0][2] = texture2Dshadow(shadowMap, shadowCoord.xy + vec2(dx0, dx1));
    depthKernel[1][0] = texture2Dshadow(shadowMap, shadowCoord.xy + vec2(0.0, dx0));
    depthKernel[1][1] = texture2Dshadow(shadowMap, shadowCoord.xy);
    depthKernel[1][2] = texture2Dshadow(shadowMap, shadowCoord.xy + vec2(0.0, dx1));
    depthKernel[2][0] = texture2Dshadow(shadowMap, shadowCoord.xy + vec2(dx1, dx0));
    depthKernel[2][1] = texture2Dshadow(shadowMap, shadowCoord.xy + vec2(dx1, 0.0));
    depthKernel[2][2] = texture2Dshadow(shadowMap, shadowCoord.xy + vec2(dx1, dx1));

    return _xgetShadowPCF3x3(depthKernel, shadowMap, shadowParams);*/

    //return texture2Dshadow(shadowMap, shadowCoord.xyz);

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

    return sum;
}

float getShadowPCF3x3(sampler2DShadow shadowMap, vec3 shadowParams) {
    return _getShadowPCF3x3(shadowMap, shadowParams);
}

float getShadowSpotPCF3x3(sampler2DShadow shadowMap, vec4 shadowParams) {
    return _getShadowPCF3x3(shadowMap, shadowParams.xyz);
}


// ----- Point Sampling -----

float getShadowPointHard(samplerCubeShadow shadowMap, vec4 shadowParams) {
    float z = length(dLightDirW) * shadowParams.w + shadowParams.z;
    return textureCubeShadow(shadowMap, vec4(dLightDirNormW, z));
}

float _getShadowPoint(samplerCubeShadow shadowMap, vec4 shadowParams, vec3 dir) {

    vec3 tc = normalize(dir);
    vec3 tcAbs = abs(tc);

    vec4 dirX = vec4(1,0,0, tc.x);
    vec4 dirY = vec4(0,1,0, tc.y);
    float majorAxisLength = tc.z;
    if ((tcAbs.x > tcAbs.y) && (tcAbs.x > tcAbs.z)) {
        dirX = vec4(0,0,1, tc.z);
        dirY = vec4(0,1,0, tc.y);
        majorAxisLength = tc.x;
    } else if ((tcAbs.y > tcAbs.x) && (tcAbs.y > tcAbs.z)) {
        dirX = vec4(1,0,0, tc.x);
        dirY = vec4(0,0,1, tc.z);
        majorAxisLength = tc.y;
    }

    float shadowParamsInFaceSpace = ((1.0/shadowParams.x) * 2.0) * abs(majorAxisLength);

    vec3 xoffset = (dirX.xyz * shadowParamsInFaceSpace);
    vec3 yoffset = (dirY.xyz * shadowParamsInFaceSpace);
    vec3 dx0 = -xoffset;
    vec3 dy0 = -yoffset;
    vec3 dx1 = xoffset;
    vec3 dy1 = yoffset;

    /*mat3 shadowKernel;
    mat3 depthKernel;

    depthKernel[0][0] = textureCubeShadow(shadowMap, tc + dx0 + dy0);
    depthKernel[0][1] = textureCubeShadow(shadowMap, tc + dx0);
    depthKernel[0][2] = textureCubeShadow(shadowMap, tc + dx0 + dy1);
    depthKernel[1][0] = textureCubeShadow(shadowMap, tc + dy0);
    depthKernel[1][1] = textureCubeShadow(shadowMap, tc);
    depthKernel[1][2] = textureCubeShadow(shadowMap, tc + dy1);
    depthKernel[2][0] = textureCubeShadow(shadowMap, tc + dx1 + dy0);
    depthKernel[2][1] = textureCubeShadow(shadowMap, tc + dx1);
    depthKernel[2][2] = textureCubeShadow(shadowMap, tc + dx1 + dy1);

    vec3 shadowZ = vec3(length(dir) * shadowParams.w + shadowParams.z);

    shadowKernel[0] = vec3(lessThan2(depthKernel[0], shadowZ));
    shadowKernel[1] = vec3(lessThan2(depthKernel[1], shadowZ));
    shadowKernel[2] = vec3(lessThan2(depthKernel[2], shadowZ));

    vec2 uv = (vec2(dirX.w, dirY.w) / abs(majorAxisLength)) * 0.5;

    vec2 fractionalCoord = fract( uv * shadowParams.x );

    shadowKernel[0] = mix(shadowKernel[0], shadowKernel[1], fractionalCoord.x);
    shadowKernel[1] = mix(shadowKernel[1], shadowKernel[2], fractionalCoord.x);

    vec4 shadowValues;
    shadowValues.x = mix(shadowKernel[0][0], shadowKernel[0][1], fractionalCoord.y);
    shadowValues.y = mix(shadowKernel[0][1], shadowKernel[0][2], fractionalCoord.y);
    shadowValues.z = mix(shadowKernel[1][0], shadowKernel[1][1], fractionalCoord.y);
    shadowValues.w = mix(shadowKernel[1][1], shadowKernel[1][2], fractionalCoord.y);

    return 1.0 - dot( shadowValues, vec4( 1.0 ) ) * 0.25;*/

    return textureCubeShadow(shadowMap, vec4(tc, vec3(length(dir) * shadowParams.w + shadowParams.z)));
}

float getShadowPointPCF3x3(samplerCubeShadow shadowMap, vec4 shadowParams) {
    return _getShadowPoint(shadowMap, shadowParams, dLightDirW);
}

