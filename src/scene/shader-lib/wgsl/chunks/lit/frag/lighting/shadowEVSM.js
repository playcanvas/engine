export default /* wgsl */`

// ------ VSM Shared ------

fn linstep(a: f32, b: f32, v: f32) -> f32 {
    // WGSL saturate -> clamp
    return clamp((v - a) / (b - a), 0.0, 1.0);
}

fn reduceLightBleeding(pMax: f32, amount: f32) -> f32 {
   // Remove the [0, amount] tail and linearly rescale (amount, 1].
   return linstep(amount, 1.0, pMax);
}

fn chebyshevUpperBound(moments: vec2f, mean: f32, minVariance: f32, lightBleedingReduction: f32) -> f32 {
    // Compute variance
    var variance: f32 = moments.y - (moments.x * moments.x);
    variance = max(variance, minVariance);

    // Compute probabilistic upper bound
    let d: f32 = mean - moments.x;
    var pMax: f32 = variance / (variance + (d * d));

    pMax = reduceLightBleeding(pMax, lightBleedingReduction);

    // One-tailed Chebyshev
    return select(pMax, 1.0, mean <= moments.x);
}

fn calculateEVSM(moments_in: vec3f, Z_in: f32, vsmBias: f32, exponent: f32) -> f32 {
    let Z: f32 = 2.0 * Z_in - 1.0;
    let warpedDepth: f32 = exp(exponent * Z);

    let moments: vec2f = moments_in.xy + vec2f(warpedDepth, warpedDepth*warpedDepth) * (1.0 - moments_in.z);

    let VSMBias: f32 = vsmBias;//0.01 * 0.25;
    let depthScale: f32 = VSMBias * exponent * warpedDepth;
    let minVariance1: f32 = depthScale * depthScale;
    return chebyshevUpperBound(moments, warpedDepth, minVariance1, 0.1);
}
// ------ VSM 16 ------

fn VSM16(tex: texture_2d<f32>, texSampler: sampler, texCoords: vec2f, resolution: f32, Z: f32, vsmBias: f32, exponent: f32) -> f32 {
    let moments: vec3f = textureSampleLevel(tex, texSampler, texCoords, 0.0).xyz;
    return calculateEVSM(moments, Z, vsmBias, exponent);
}

fn getShadowVSM16(shadowMap: texture_2d<f32>, shadowMapSampler: sampler, shadowCoord: vec3f, shadowParams: vec4f, exponent: f32) -> f32 {
    return VSM16(shadowMap, shadowMapSampler, shadowCoord.xy, shadowParams.x, shadowCoord.z, shadowParams.y, exponent);
}

fn getShadowSpotVSM16(shadowMap: texture_2d<f32>, shadowMapSampler: sampler, shadowCoord: vec3f, shadowParams: vec4f, exponent: f32, lightDir: vec3f) -> f32 {
    let Z: f32 = length(lightDir) * shadowParams.w + shadowParams.z;
    return VSM16(shadowMap, shadowMapSampler, shadowCoord.xy, shadowParams.x, Z, shadowParams.y, exponent);
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
fn calculateEVSM4(moments: vec4f, Z: f32, vsmBias: f32, exponent: f32) -> f32 {

    // exponent of the negative warp. Note: this must match the shadow caster chunks.
    let negExponent: f32 = 5.0;

    let d: f32 = 2.0 * Z - 1.0;

    // warped depth of the receiver, for both warps
    let posMean: f32 = exp(exponent * d);
    let negExp: f32 = exp(-negExponent * d);
    let negMean: f32 = -negExp;

    // the depth bias is scaled by the derivative of each warp, to keep it in depth units
    let posScale: f32 = vsmBias * exponent * posMean;
    let negScale: f32 = vsmBias * negExponent * negExp;

    let posBound: f32 = chebyshevUpperBound(moments.xy, posMean, posScale * posScale, 0.1);
    let negBound: f32 = chebyshevUpperBound(moments.zw, negMean, negScale * negScale, 0.1);

    // both are upper bounds on the visibility, so the tighter one is the better estimate
    return min(posBound, negBound);
}

fn VSM32(tex: texture_2d<f32>, texSampler: sampler, texCoords_in: vec2f, resolution: f32, Z: f32, vsmBias: f32, exponent: f32) -> f32 {

    #ifdef CAPS_TEXTURE_FLOAT_FILTERABLE
        var moments: vec4f = textureSampleLevel(tex, texSampler, texCoords_in, 0.0);
    #else
        // manual bilinear filtering
        var pixelSize : f32 = 1.0 / resolution;
        let texCoords: vec2f = texCoords_in - vec2f(pixelSize);
        let s00: vec4f = textureSampleLevel(tex, texSampler, texCoords, 0.0);
        let s10: vec4f = textureSampleLevel(tex, texSampler, texCoords + vec2f(pixelSize, 0.0), 0.0);
        let s01: vec4f = textureSampleLevel(tex, texSampler, texCoords + vec2f(0.0, pixelSize), 0.0);
        let s11: vec4f = textureSampleLevel(tex, texSampler, texCoords + vec2f(pixelSize), 0.0);
        let fr: vec2f = fract(texCoords * resolution);
        let h0: vec4f = mix(s00, s10, fr.x);
        let h1: vec4f = mix(s01, s11, fr.x);
        var moments: vec4f = mix(h0, h1, fr.y);
    #endif

    return calculateEVSM4(moments, Z, vsmBias, exponent);
}

fn getShadowVSM32(shadowMap: texture_2d<f32>, shadowMapSampler: sampler, shadowCoord: vec3f, shadowParams: vec4f, exponent: f32) -> f32 {
    return VSM32(shadowMap, shadowMapSampler, shadowCoord.xy, shadowParams.x, shadowCoord.z, shadowParams.y, exponent);
}

fn getShadowSpotVSM32(shadowMap: texture_2d<f32>, shadowMapSampler: sampler, shadowCoord: vec3f, shadowParams: vec4f, exponent: f32, lightDir: vec3f) -> f32 {
    let Z: f32 = length(lightDir) * shadowParams.w + shadowParams.z;
    return VSM32(shadowMap, shadowMapSampler, shadowCoord.xy, shadowParams.x, Z, shadowParams.y, exponent);
}
`;
