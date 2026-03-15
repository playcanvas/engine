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

// ------ VSM 32 ------

float VSM32(TEXTURE_ACCEPT(tex), vec2 texCoords, float resolution, float Z, float vsmBias, float exponent) {

    #ifdef CAPS_TEXTURE_FLOAT_FILTERABLE
        vec3 moments = texture2DLod(tex, texCoords, 0.0).xyz;
    #else
        // manual bilinear filtering
        float pixelSize = 1.0 / resolution;
        texCoords -= vec2(pixelSize);
        vec3 s00 = texture2DLod(tex, texCoords, 0.0).xyz;
        vec3 s10 = texture2DLod(tex, texCoords + vec2(pixelSize, 0), 0.0).xyz;
        vec3 s01 = texture2DLod(tex, texCoords + vec2(0, pixelSize), 0.0).xyz;
        vec3 s11 = texture2DLod(tex, texCoords + vec2(pixelSize), 0.0).xyz;
        vec2 fr = fract(texCoords * resolution);
        vec3 h0 = mix(s00, s10, fr.x);
        vec3 h1 = mix(s01, s11, fr.x);
        vec3 moments = mix(h0, h1, fr.y);
    #endif

    return calculateEVSM(moments, Z, vsmBias, exponent);
}

float getShadowVSM32(TEXTURE_ACCEPT(shadowMap), vec3 shadowCoord, vec4 shadowParams, float exponent) {
    return VSM32(TEXTURE_PASS(shadowMap), shadowCoord.xy, shadowParams.x, shadowCoord.z, shadowParams.y, exponent);
}

float getShadowSpotVSM32(TEXTURE_ACCEPT(shadowMap), vec3 shadowCoord, vec4 shadowParams, float exponent, vec3 lightDir) {
    float Z = length(lightDir) * shadowParams.w + shadowParams.z;
    return VSM32(TEXTURE_PASS(shadowMap), shadowCoord.xy, shadowParams.x, Z, shadowParams.y, exponent);
}
`;
