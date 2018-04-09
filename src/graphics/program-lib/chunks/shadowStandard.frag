vec3 lessThan2(vec3 a, vec3 b) {
    return clamp((b - a)*1000.0, 0.0, 1.0); // softer version
}

#ifndef UNPACKFLOAT
#define UNPACKFLOAT
float unpackFloat(vec4 rgbaDepth) {
    const vec4 bitShift = vec4(1.0 / (256.0 * 256.0 * 256.0), 1.0 / (256.0 * 256.0), 1.0 / 256.0, 1.0);
    return dot(rgbaDepth, bitShift);
}
#endif

// ----- Direct/Spot Sampling -----

#ifdef GL2
    float _getShadowPCF3x3(sampler2DShadow shadowMap, vec3 shadowParams) {
        float z = dShadowCoord.z;
        vec2 uv = dShadowCoord.xy * shadowParams.x; // 1 unit - 1 texel
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

        sum += uw0 * vw0 * texture(shadowMap, vec3(u0, v0, z));
        sum += uw1 * vw0 * texture(shadowMap, vec3(u1, v0, z));
        sum += uw0 * vw1 * texture(shadowMap, vec3(u0, v1, z));
        sum += uw1 * vw1 * texture(shadowMap, vec3(u1, v1, z));

        sum *= 1.0f / 16.0;
        return sum;
    }

    float getShadowPCF3x3(sampler2DShadow shadowMap, vec3 shadowParams) {
        return _getShadowPCF3x3(shadowMap, shadowParams);
    }

    float getShadowSpotPCF3x3(sampler2DShadow shadowMap, vec4 shadowParams) {
        return _getShadowPCF3x3(shadowMap, shadowParams.xyz);
    }
#else
    float _xgetShadowPCF3x3(mat3 depthKernel, sampler2D shadowMap, vec3 shadowParams) {
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
    }

    float _getShadowPCF3x3(sampler2D shadowMap, vec3 shadowParams) {
        vec3 shadowCoord = dShadowCoord;

        float xoffset = 1.0 / shadowParams.x; // 1/shadow map width
        float dx0 = -xoffset;
        float dx1 = xoffset;

        mat3 depthKernel;
        depthKernel[0][0] = unpackFloat(texture2D(shadowMap, shadowCoord.xy + vec2(dx0, dx0)));
        depthKernel[0][1] = unpackFloat(texture2D(shadowMap, shadowCoord.xy + vec2(dx0, 0.0)));
        depthKernel[0][2] = unpackFloat(texture2D(shadowMap, shadowCoord.xy + vec2(dx0, dx1)));
        depthKernel[1][0] = unpackFloat(texture2D(shadowMap, shadowCoord.xy + vec2(0.0, dx0)));
        depthKernel[1][1] = unpackFloat(texture2D(shadowMap, shadowCoord.xy));
        depthKernel[1][2] = unpackFloat(texture2D(shadowMap, shadowCoord.xy + vec2(0.0, dx1)));
        depthKernel[2][0] = unpackFloat(texture2D(shadowMap, shadowCoord.xy + vec2(dx1, dx0)));
        depthKernel[2][1] = unpackFloat(texture2D(shadowMap, shadowCoord.xy + vec2(dx1, 0.0)));
        depthKernel[2][2] = unpackFloat(texture2D(shadowMap, shadowCoord.xy + vec2(dx1, dx1)));

        return _xgetShadowPCF3x3(depthKernel, shadowMap, shadowParams);
    }

    float getShadowPCF3x3(sampler2D shadowMap, vec3 shadowParams) {
        return _getShadowPCF3x3(shadowMap, shadowParams);
    }

    float getShadowSpotPCF3x3(sampler2D shadowMap, vec4 shadowParams) {
        return _getShadowPCF3x3(shadowMap, shadowParams.xyz);
    }
#endif


// ----- Point Sampling -----

float _getShadowPoint(samplerCube shadowMap, vec4 shadowParams, vec3 dir) {

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

    mat3 shadowKernel;
    mat3 depthKernel;

    depthKernel[0][0] = unpackFloat(textureCube(shadowMap, tc + dx0 + dy0));
    depthKernel[0][1] = unpackFloat(textureCube(shadowMap, tc + dx0));
    depthKernel[0][2] = unpackFloat(textureCube(shadowMap, tc + dx0 + dy1));
    depthKernel[1][0] = unpackFloat(textureCube(shadowMap, tc + dy0));
    depthKernel[1][1] = unpackFloat(textureCube(shadowMap, tc));
    depthKernel[1][2] = unpackFloat(textureCube(shadowMap, tc + dy1));
    depthKernel[2][0] = unpackFloat(textureCube(shadowMap, tc + dx1 + dy0));
    depthKernel[2][1] = unpackFloat(textureCube(shadowMap, tc + dx1));
    depthKernel[2][2] = unpackFloat(textureCube(shadowMap, tc + dx1 + dy1));

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

    return 1.0 - dot( shadowValues, vec4( 1.0 ) ) * 0.25;
}

float getShadowPointPCF3x3(samplerCube shadowMap, vec4 shadowParams) {
    return _getShadowPoint(shadowMap, shadowParams, dLightDirW);
}

