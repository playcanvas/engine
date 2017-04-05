void _getShadowCoordPerspZbuffer(mat4 shadowMatrix, vec4 shadowParams, vec3 wPos) {
    vec4 projPos = shadowMatrix * vec4(wPos, 1.0);
    projPos.xyz /= projPos.w;
    dShadowCoord = projPos.xyz;

    // fix ddx/ddy inaccuracy in receiver plane depth bias
    vec3 fwd = vec3(shadowMatrix[0][3], shadowMatrix[1][3], shadowMatrix[2][3]);
    float dt = dot(fwd, -vNormalW);
    if (dt > 0.99) {
        dShadowCoord.z -= shadowParams.z * 0.01;
    } else {
        dShadowCoord.z += getShadowBias(shadowParams.x, shadowParams.z);
    }
}

void getShadowCoordPerspZbufferNormalOffset(mat4 shadowMatrix, vec4 shadowParams) {
    float distScale = abs(dot(vPositionW - dLightPosW, dLightDirNormW)); // fov?
    vec3 wPos = vPositionW + vNormalW * shadowParams.y * clamp(1.0 - dot(vNormalW, -dLightDirNormW), 0.0, 1.0) * distScale;
    _getShadowCoordPerspZbuffer(shadowMatrix, shadowParams, wPos);
}

void getShadowCoordPerspZbuffer(mat4 shadowMatrix, vec4 shadowParams) {
    _getShadowCoordPerspZbuffer(shadowMatrix, shadowParams, vPositionW);
}

