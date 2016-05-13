// ----- Unpacking -----

float unpackFloat(vec4 rgbaDepth) {
    const vec4 bitShift = vec4(1.0 / (256.0 * 256.0 * 256.0), 1.0 / (256.0 * 256.0), 1.0 / 256.0, 1.0);
    return dot(rgbaDepth, bitShift);
}

/*float decodeFloatRG(vec2 rg) {
    return rg.y*(1.0/255.0) + rg.x;
}

vec2 unpackVSM(vec4 encoded) {
    return vec2(decodeFloatRG(encoded.xy), decodeFloatRG(encoded.zw));
}*/

float decodeSuperHalf( vec2 enc ) {
    float y = enc.y * 10.0;
    float exponent = floor(y);
    float significand = (y - exponent) * (1.0/255.0) + enc.x;
    return significand * pow(10.0, exponent);

    /*float y = enc.y * 255.0;
    float exponent = floor(y / 32.0);
    float significand = floor(mod(y,32.0))/255.0 + enc.x;
    return significand * pow(10.0, exponent);*/
}

vec2 unpackEVSM(vec4 encoded) {
    return vec2(decodeSuperHalf(encoded.xy), decodeSuperHalf(encoded.zw));
}


// ----- Aux -----

vec3 lessThan2(vec3 a, vec3 b) {
    return clamp((b - a)*1000.0, 0.0, 1.0); // softer version
}

vec3 greaterThan2(vec3 a, vec3 b) {
    return clamp((a - b)*1000.0, 0.0, 1.0); // softer version
}

float Linstep(float a, float b, float v)
{
    return saturate((v - a) / (b - a));
}

// Reduces VSM light bleedning
float ReduceLightBleeding(float pMax, float amount)
{
  // Remove the [0, amount] tail and linearly rescale (amount, 1].
   return Linstep(amount, 1.0, pMax);
}

float ChebyshevUpperBound(vec2 moments, float mean, float minVariance,
                          float lightBleedingReduction)
{
    // Compute variance
    float variance = moments.y - (moments.x * moments.x);
    variance = max(variance, minVariance);

    // Compute probabilistic upper bound
    float d = mean - moments.x;
    float pMax = variance / (variance + (d * d));

    pMax = ReduceLightBleeding(pMax, lightBleedingReduction);

    // One-tailed Chebyshev
    return (mean <= moments.x ? 1.0 : pMax);
}

float decodeFloatRGBA( vec4 rgba ) {
  return dot( rgba, vec4(1.0, 1.0/255.0, 1.0/65025.0, 1.0/160581375.0) );
}

float VSM(vec2 moments, float Z) {

    /*vec4 img = texture2D(light0_shadowMap, dShadowCoord.xy);
    moments.x = img.x;
    Z -= 0.001;
    Z = 2.0 * Z - 1.0;
    Z = exp(10.0 * Z);
    float fDarkeningFactor = 4.0;
    return saturate( exp( fDarkeningFactor * ( moments.x - Z ) ) );*/

    //return (sqrt(moments.y) < Z-0.001) ? 0.0 : 1.0;

    /*float exponent = 48.0;
    vec4 img = texture2D(light0_shadowMap, dShadowCoord.xy);
    moments.x = decodeFloatRGBA(img) * exp(exponent);
    return moments.x / exp(exponent * Z);*/


    //vec4 img = texture2D(light0_shadowMap, dShadowCoord.xy);
    //moments = img.xy;

    float exponent = 10.0;

    // Applies exponential warp to shadow map depth, input depth should be in [0, 1]
    // Rescale depth into [-1, 1]
    Z = 2.0 * Z - 1.0;
    float warpedDepth = exp(exponent * Z);

    // Derivative of warping at depth
    float VSMBias = 0.01 * 0.25;
    float depthScale = VSMBias * exponent * warpedDepth;
    float minVariance1 = depthScale * depthScale;

    // Positive only
    return ChebyshevUpperBound(moments.xy, warpedDepth, minVariance1, 0.05);//0.1);


    //return ChebyshevUpperBound(moments.xy, Z, 0.000005, 0.1);


    /*float minVariance = 0.00002;
    float p = (Z <= moments.x)? 1.0 : 0.0;
    float Variance = moments.y - ( moments.x * moments.x );
    Variance = max( Variance, minVariance);
    float d = Z - moments.x;
    float p_max = Variance / (Variance + d*d);

    float sharpReduction = 0.8;
    float smoothReduction = 0.1;
    float reduction = mix(sharpReduction, smoothReduction, saturate(d * 20.0));
    p_max = ReduceLightBleeding(p_max, 0.1);//reduction);

    float shadow = max(p,p_max);
    return shadow;*/


    /*float blocker = sqrt(saturate(moments.y - moments.x*moments.x));

    float dd2 = 1.0 - blocker;
    float inBlack2 = mix(0.0, 0.45, dd2);
    float inWhite2 = mix(1.0, 0.55, dd2);
    shadow = max(shadow - inBlack2, 0.0) / (inWhite2 - inBlack2);
    shadow = saturate(shadow);
    return shadow;*/



    /*float dd = 1.0 - saturate(d * 10.0);
    float inBlack = mix(0.0, 0.4, dd);
    float inWhite = mix(1.0, 0.6, dd);
    shadow = max(shadow - inBlack, 0.0) / (inWhite - inBlack);
    shadow = saturate(shadow);*/

    // ESM
    //float fDarkeningFactor = 220.0;//22.0;
    //shadow = saturate( exp( fDarkeningFactor * ( moments.x - Z ) ) );

    //float sigma = sqrt(saturate(moments.y - moments.x*moments.x));
    //float d_blocker = saturate(moments.x - 1.5*sigma);

    /*float bd1 = moments.x;
    float bd2 = moments.y;
    float d1 = Z;
    //float bdepth = clamp( bd1 - sqrt( bd2 - bd1*bd1 ), 1e-15, d1 );
    float bdepth = saturate(bd1 - sqrt( saturate(bd2 - bd1*bd1) ));
    float light_diameter = 0.1;
    float wpen = saturate(light_diameter * (d1 - bdepth) / bdepth);

    //moments.y = moments.x;
    //moments.y = 1.0 - moments.y;

    d = Z - moments.y;
    float dd = saturate(d * 5.0);
    //float dd = pow(1.0 - d, 12.0);
    //dd = saturate((1.0 - moments.y)*2.0);
    //dd = saturate( (0.1 * (Z - moments.y) / moments.y) * 35.0 );

    //float dd2 = pow(1.0-pow(1.0-wpen,64.0),64.0);

    float fDarkeningFactor = mix(220.0*2.0, 48.0, dd);//saturate((Z - moments.y) * 5.0));
    //float fDarkeningFactor = mix(220.0, 48.0, dd2);//saturate((Z - moments.y) * 5.0));
    //float scale = 0.5;
    shadow = saturate( exp( fDarkeningFactor * ( moments.x - Z ) ) );

    //float inBlack = mix(0.0, 0.45, dd);
    //float inWhite = mix(1.0, 0.55, dd);
    //float inBlack = mix(0.0, 0.35, dd);
    //float inWhite = mix(1.0, 0.45, dd);
    float inBlack = mix(0.0, 0.95, 1.0-dd);
    float inWhite = mix(1.0, 0.99, 1.0-dd);
    shadow = max(shadow - inBlack, 0.0) / (inWhite - inBlack);
    shadow = saturate(shadow);

    //shadow = saturate((Z - moments.y) * 10.0);
    //shadow = moments.y;

    //shadow = bdepth;

    //float sharpShadow = ((moments.x+0.005) < Z) ? 0.0 : 1.0;
    //shadow = min(shadow, sharpShadow);
    //shadow = moments.y;
    //shadow = dd;

    return shadow;*/
}


// ----- Direct/Spot Sampling -----

float getShadowHard(sampler2D shadowMap, vec3 shadowParams) {
    float depth = unpackFloat(texture2D(shadowMap, dShadowCoord.xy));
    return (depth < dShadowCoord.z) ? 0.0 : 1.0;
}

float getShadowSpotHard(sampler2D shadowMap, vec4 shadowParams) {
    float depth = unpackFloat(texture2D(shadowMap, dShadowCoord.xy));
    return (depth < (length(dLightDirW) * shadowParams.w + shadowParams.z)) ? 0.0 : 1.0;
}

float getShadowVSM(sampler2D shadowMap, vec3 shadowParams) {
    vec2 moments = unpackEVSM(texture2D(shadowMap, dShadowCoord.xy));
    return VSM(moments, dShadowCoord.z);
}

float getShadowSpotVSM(sampler2D shadowMap, vec4 shadowParams) {
    vec2 moments = unpackEVSM(texture2D(shadowMap, dShadowCoord.xy));
    return VSM(moments, length(dLightDirW) * shadowParams.w + shadowParams.z);
}

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
    dShadowCoord.z = length(dLightDirW) * shadowParams.w + shadowParams.z;
    return _getShadowPCF3x3(shadowMap, shadowParams.xyz);
}


// ----- Point Sampling -----

float getShadowPointHard(samplerCube shadowMap, vec4 shadowParams) {
    float depth = unpackFloat(textureCube(shadowMap, dLightDirNormW));
    return float(depth > length(dLightDirW) * shadowParams.w + shadowParams.z);
}

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

void normalOffsetPointShadow(vec4 shadowParams) {
    float distScale = length(dLightDirW);
    vec3 wPos = vPositionW + vNormalW * shadowParams.y * clamp(1.0 - dot(vNormalW, -dLightDirNormW), 0.0, 1.0) * distScale; //0.02
    vec3 dir = wPos - dLightPosW;
    dLightDirW = dir;
}

