void _getShadowCoordOrtho(inout psInternalData data, mat4 shadowMatrix, vec3 shadowParams, vec3 wPos) {
    vec4 projPos = shadowMatrix * vec4(wPos, 1.0);
    projPos.z += shadowParams.z;
    projPos.z = min(projPos.z, 1.0);
    data.shadowCoord = projPos.xyz;
}

void _getShadowCoordPersp(inout psInternalData data, mat4 shadowMatrix, vec3 shadowParams, vec3 wPos) {
    vec4 projPos = shadowMatrix * vec4(wPos, 1.0);
    projPos.xyz /= projPos.w;
    projPos.z += shadowParams.z;
    data.shadowCoord = projPos.xyz;
}

void getShadowCoordOrtho(inout psInternalData data, mat4 shadowMatrix, vec3 shadowParams) {
    _getShadowCoordOrtho(data, shadowMatrix, shadowParams, vPositionW);
}

void getShadowCoordPersp(inout psInternalData data, mat4 shadowMatrix, vec3 shadowParams) {
    _getShadowCoordPersp(data, shadowMatrix, shadowParams, vPositionW);
}

void getShadowCoordPerspNormalOffset(inout psInternalData data, mat4 shadowMatrix, vec3 shadowParams) {
    float distScale = abs(dot(vPositionW - data.lightPosW, data.lightDirNormW)); // fov?
    vec3 wPos = vPositionW + vNormalW * shadowParams.y * clamp(1.0 - dot(vNormalW, -data.lightDirNormW), 0.0, 1.0) * distScale;

    _getShadowCoordPersp(data, shadowMatrix, shadowParams, wPos);
}

void getShadowCoordOrthoNormalOffset(inout psInternalData data, mat4 shadowMatrix, vec3 shadowParams) {
    vec3 wPos = vPositionW + vNormalW * shadowParams.y * clamp(1.0 - dot(vNormalW, -data.lightDirNormW), 0.0, 1.0); //0.08

    _getShadowCoordOrtho(data, shadowMatrix, shadowParams, wPos);
}

