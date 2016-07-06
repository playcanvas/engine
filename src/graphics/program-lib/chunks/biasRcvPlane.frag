vec2 computeReceiverPlaneDepthBias(vec3 texCoordDX, vec3 texCoordDY) {
    vec2 biasUV;
    biasUV.x = texCoordDY.y * texCoordDX.z - texCoordDX.y * texCoordDY.z;
    biasUV.y = texCoordDX.x * texCoordDY.z - texCoordDY.x * texCoordDX.z;
    biasUV *= 1.0 / ((texCoordDX.x * texCoordDY.y) - (texCoordDX.y * texCoordDY.x));
    return biasUV;
}

vec3 fixVector(vec3 vec) {
    // fix dFdx/dFdy precision issues, visible when light faces geometry normal
    vec3 signs = vec3(greaterThan(vec, vec3(0.0))) * 2.0 - vec3(1.0);
    return (abs(vec) + vec3(0.00001)) * signs;
}

float getShadowBias(float resolution, float maxBias) {
    vec3 shadowPosDX = dFdx(dShadowCoord);
    vec3 shadowPosDY = dFdy(dShadowCoord);
    vec2 texelSize = vec2(1.0 / resolution);

    shadowPosDX = fixVector(shadowPosDX);
    shadowPosDY = fixVector(shadowPosDY);

    vec2 receiverPlaneDepthBias = computeReceiverPlaneDepthBias(shadowPosDX, shadowPosDY);
    float fractionalSamplingError = 2.0 * dot(vec2(texelSize), abs(receiverPlaneDepthBias));

    return -min(fractionalSamplingError, maxBias);
}

