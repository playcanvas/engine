export default /* glsl */`

// ------ VSM Shared ------

float linstep(float a, float b, float v) {
    return saturate((v - a) / (b - a));
}

float reduceLightBleeding(float pMax, float amount) {
   // Remove the [0, amount] tail and linearly rescale (amount, 1].
   return linstep(amount, 1.0, pMax);
}

float chebyshevUpperBound(vec2 moments, float mean, float minVariance, float lightBleedingReduction) {
    // Compute variance
    float variance = moments.y - (moments.x * moments.x);
    variance = max(variance, minVariance);

    // Compute probabilistic upper bound
    float d = mean - moments.x;
    float pMax = variance / (variance + (d * d));

    pMax = reduceLightBleeding(pMax, lightBleedingReduction);

    // One-tailed Chebyshev
    return (mean <= moments.x ? 1.0 : pMax);
}

float calculateEVSM(vec3 moments, float Z, float vsmBias, float exponent) {
    Z = 2.0 * Z - 1.0;
    float warpedDepth = exp(exponent * Z);

    moments.xy += vec2(warpedDepth, warpedDepth*warpedDepth) * (1.0 - moments.z);

    float VSMBias = vsmBias;//0.01 * 0.25;
    float depthScale = VSMBias * exponent * warpedDepth;
    float minVariance1 = depthScale * depthScale;
    return chebyshevUpperBound(moments.xy, warpedDepth, minVariance1, 0.1);
}

// ------ VSM 16 ------

float VSM16(TEXTURE_ACCEPT(tex), vec2 texCoords, float resolution, float Z, float vsmBias, float exponent) {
    vec3 moments = texture2DLod(tex, texCoords, 0.0).xyz;
    return calculateEVSM(moments, Z, vsmBias, exponent);
}

float getShadowVSM16(TEXTURE_ACCEPT(shadowMap), vec3 shadowCoord, vec4 shadowParams, float exponent) {
    return VSM16(TEXTURE_PASS(shadowMap), shadowCoord.xy, shadowParams.x, shadowCoord.z, shadowParams.y, exponent);
}

float getShadowSpotVSM16(TEXTURE_ACCEPT(shadowMap), vec3 shadowCoord, vec4 shadowParams, float exponent, vec3 lightDir) {
    return VSM16(TEXTURE_PASS(shadowMap), shadowCoord.xy, shadowParams.x, length(lightDir) * shadowParams.w + shadowParams.z, shadowParams.y, exponent);
}

// ------ VSM 32 (EVSM4) ------

// VSM_32F stores four moments - a positive and a negative exponential warp of the depth, each with
// its second moment. Both warps are monotonically increasing functions of the depth:
//     positive: exp(exponent * d)      - resolves depth differences near the far plane
//     negative: -exp(-negExponent * d)  - resolves depth differences near the light
// A Chebyshev bound is evaluated for each warp and the tighter (smaller) of the two is used. The
// positive warp on its own (EVSM2) is a soft maximum, so a single deep texel within the filter
// kernel dominates the filtered result and can make an occluded receiver appear lit. The negative
// warp is a soft minimum, and so does not suffer from this, and taking the minimum of the two
// bounds removes those light leaks. See "Layered Variance Shadow Maps", Lauritzen & McCool.
float calculateEVSM4(vec4 moments, float Z, float vsmBias, float exponent) {

    // exponent of the negative warp. Note: this must match the shadow caster chunks.
    float negExponent = 5.0;

    float d = 2.0 * Z - 1.0;

    // warped depth of the receiver, for both warps
    float posMean = exp(exponent * d);
    float negExp = exp(-negExponent * d);
    float negMean = -negExp;

    // the depth bias is scaled by the derivative of each warp, to keep it in depth units
    float posScale = vsmBias * exponent * posMean;
    float negScale = vsmBias * negExponent * negExp;

    float posBound = chebyshevUpperBound(moments.xy, posMean, posScale * posScale, 0.1);
    float negBound = chebyshevUpperBound(moments.zw, negMean, negScale * negScale, 0.1);

    // both are upper bounds on the visibility, so the tighter one is the better estimate
    return min(posBound, negBound);
}

float VSM32(TEXTURE_ACCEPT(tex), vec2 texCoords, float resolution, float Z, float vsmBias, float exponent) {

    #ifdef CAPS_TEXTURE_FLOAT_FILTERABLE
        vec4 moments = texture2DLod(tex, texCoords, 0.0);
    #else
        // manual bilinear filtering
        float pixelSize = 1.0 / resolution;
        texCoords -= vec2(pixelSize);
        vec4 s00 = texture2DLod(tex, texCoords, 0.0);
        vec4 s10 = texture2DLod(tex, texCoords + vec2(pixelSize, 0), 0.0);
        vec4 s01 = texture2DLod(tex, texCoords + vec2(0, pixelSize), 0.0);
        vec4 s11 = texture2DLod(tex, texCoords + vec2(pixelSize), 0.0);
        vec2 fr = fract(texCoords * resolution);
        vec4 h0 = mix(s00, s10, fr.x);
        vec4 h1 = mix(s01, s11, fr.x);
        vec4 moments = mix(h0, h1, fr.y);
    #endif

    return calculateEVSM4(moments, Z, vsmBias, exponent);
}

float getShadowVSM32(TEXTURE_ACCEPT(shadowMap), vec3 shadowCoord, vec4 shadowParams, float exponent) {
    return VSM32(TEXTURE_PASS(shadowMap), shadowCoord.xy, shadowParams.x, shadowCoord.z, shadowParams.y, exponent);
}

float getShadowSpotVSM32(TEXTURE_ACCEPT(shadowMap), vec3 shadowCoord, vec4 shadowParams, float exponent, vec3 lightDir) {
    float Z = length(lightDir) * shadowParams.w + shadowParams.z;
    return VSM32(TEXTURE_PASS(shadowMap), shadowCoord.xy, shadowParams.x, Z, shadowParams.y, exponent);
}
`;
