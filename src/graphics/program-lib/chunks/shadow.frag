// ----- Unpacking -----

float unpackFloat(vec4 rgbaDepth) {
    const vec4 bitShift = vec4(1.0 / (256.0 * 256.0 * 256.0), 1.0 / (256.0 * 256.0), 1.0 / 256.0, 1.0);
    return dot(rgbaDepth, bitShift);
}

float unpackMask(vec4 rgbaDepth) {
    return rgbaDepth.x;
}

float unpackFloatYZW(vec4 enc) {
    const vec4 bitShift = vec4(1.0 / (256.0 * 256.0 * 256.0), 1.0 / (256.0 * 256.0), 1.0 / 256.0, 1.0);
    float v = dot(enc.yzw, bitShift.yzw);
    return v;
}


// ----- Aux -----

vec3 lessThan2(vec3 a, vec3 b) {
    return clamp((b - a)*1000.0, 0.0, 1.0); // softer version
}

vec3 greaterThan2(vec3 a, vec3 b) {
    return clamp((a - b)*1000.0, 0.0, 1.0); // softer version
}


// ----- Direct/Spot Sampling -----

float getShadowHard(inout psInternalData data, sampler2D shadowMap, vec3 shadowParams) {
    float depth = unpackFloat(texture2D(shadowMap, data.shadowCoord.xy));
    return (depth < data.shadowCoord.z) ? 0.0 : 1.0;
}

float getShadowMask(inout psInternalData data, sampler2D shadowMap, vec3 shadowParams) {
    return unpackMask(texture2D(shadowMap, data.shadowCoord.xy));
}

float _xgetShadowPCF3x3(mat3 depthKernel, inout psInternalData data, sampler2D shadowMap, vec3 shadowParams) {
    mat3 shadowKernel;
    vec3 shadowCoord = data.shadowCoord;
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

float _getShadowPCF3x3(inout psInternalData data, sampler2D shadowMap, vec3 shadowParams) {
    vec3 shadowCoord = data.shadowCoord;

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

    return _xgetShadowPCF3x3(depthKernel, data, shadowMap, shadowParams);
}

float getShadowPCF3x3(inout psInternalData data, sampler2D shadowMap, vec3 shadowParams) {
    return _getShadowPCF3x3(data, shadowMap, shadowParams);
}

float _getShadowPCF3x3_YZW(inout psInternalData data, sampler2D shadowMap, vec3 shadowParams) {
    vec3 shadowCoord = data.shadowCoord;

    float xoffset = 1.0 / shadowParams.x; // 1/shadow map width
    float dx0 = -xoffset;
    float dx1 = xoffset;

    mat3 depthKernel;
    depthKernel[0][0] = unpackFloatYZW(texture2D(shadowMap, shadowCoord.xy + vec2(dx0, dx0)));
    depthKernel[0][1] = unpackFloatYZW(texture2D(shadowMap, shadowCoord.xy + vec2(dx0, 0.0)));
    depthKernel[0][2] = unpackFloatYZW(texture2D(shadowMap, shadowCoord.xy + vec2(dx0, dx1)));
    depthKernel[1][0] = unpackFloatYZW(texture2D(shadowMap, shadowCoord.xy + vec2(0.0, dx0)));
    depthKernel[1][1] = unpackFloatYZW(texture2D(shadowMap, shadowCoord.xy));
    depthKernel[1][2] = unpackFloatYZW(texture2D(shadowMap, shadowCoord.xy + vec2(0.0, dx1)));
    depthKernel[2][0] = unpackFloatYZW(texture2D(shadowMap, shadowCoord.xy + vec2(dx1, dx0)));
    depthKernel[2][1] = unpackFloatYZW(texture2D(shadowMap, shadowCoord.xy + vec2(dx1, 0.0)));
    depthKernel[2][2] = unpackFloatYZW(texture2D(shadowMap, shadowCoord.xy + vec2(dx1, dx1)));

    return _xgetShadowPCF3x3(depthKernel, data, shadowMap, shadowParams);
}

float getShadowPCF3x3_YZW(inout psInternalData data, sampler2D shadowMap, vec3 shadowParams) {
    return _getShadowPCF3x3_YZW(data, shadowMap, shadowParams);
}


// ----- Point Sampling -----

float getShadowPointHard(inout psInternalData data, samplerCube shadowMap, vec4 shadowParams) {
    return float(unpackFloat(textureCube(shadowMap, data.lightDirNormW)) > (length(data.lightDirW) * shadowParams.w + shadowParams.z));
}

float _getShadowPoint(inout psInternalData data, samplerCube shadowMap, vec4 shadowParams, vec3 dir) {

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

float getShadowPointPCF3x3(inout psInternalData data, samplerCube shadowMap, vec4 shadowParams) {
    return _getShadowPoint(data, shadowMap, shadowParams, data.lightDirW);
}

void normalOffsetPointShadow(inout psInternalData data, vec4 shadowParams) {
    float distScale = length(data.lightDirW);
    vec3 wPos = vPositionW + vNormalW * shadowParams.y * clamp(1.0 - dot(vNormalW, -data.lightDirNormW), 0.0, 1.0) * distScale; //0.02
    vec3 dir = wPos - data.lightPosW;
    data.lightDirW = dir;
}

