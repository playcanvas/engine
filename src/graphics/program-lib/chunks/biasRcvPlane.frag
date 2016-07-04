vec2 computeReceiverPlaneDepthBias(vec3 texCoordDX, vec3 texCoordDY) {
    vec2 biasUV;
    biasUV.x = texCoordDY.y * texCoordDX.z - texCoordDX.y * texCoordDY.z;
    biasUV.y = texCoordDX.x * texCoordDY.z - texCoordDY.x * texCoordDX.z;
    biasUV *= 1.0 / ((texCoordDX.x * texCoordDY.y) - (texCoordDX.y * texCoordDY.x));
    return biasUV;
}

float getShadowBias(float resolution, float maxBias) {
    vec3 shadowPosDX = dFdx(dShadowCoord);
    vec3 shadowPosDY = dFdy(dShadowCoord);
    vec2 texelSize = vec2(1.0 / resolution);

    vec2 receiverPlaneDepthBias = computeReceiverPlaneDepthBias(shadowPosDX, shadowPosDY);
    float fractionalSamplingError = 2.0 * dot(vec2(1.0) * texelSize, abs(receiverPlaneDepthBias));

    return -min(fractionalSamplingError, maxBias);
}

