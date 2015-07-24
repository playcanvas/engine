void getLightDirPoint(inout vsInternalData data, vec3 lightPosW) {
    vec3 lightDirW = vPositionW - lightPosW;
    data.lightDirNormW = normalize(lightDirW);
    data.lightPosW = lightPosW;
}

void _getShadowCoordOrtho(inout vsInternalData data, mat4 shadowMatrix, vec3 shadowParams, vec3 wPos) {
    vec4 projPos = shadowMatrix * vec4(wPos, 1.0);
    vMainShadowUv = projPos;
}

void _getShadowCoordPersp(inout vsInternalData data, mat4 shadowMatrix, vec3 shadowParams, vec3 wPos) {
    vec4 projPos = shadowMatrix * vec4(wPos, 1.0);
    vMainShadowUv = projPos;
}

void getShadowCoordOrtho(inout vsInternalData data, mat4 shadowMatrix, vec3 shadowParams) {
    _getShadowCoordOrtho(data, shadowMatrix, shadowParams, vPositionW);
}

void getShadowCoordPersp(inout vsInternalData data, mat4 shadowMatrix, vec3 shadowParams) {
    _getShadowCoordPersp(data, shadowMatrix, shadowParams, vPositionW);
}

void getShadowCoordPerspNormalOffset(inout vsInternalData data, mat4 shadowMatrix, vec3 shadowParams) {
    float distScale = abs(dot(vPositionW - data.lightPosW, data.lightDirNormW)); // fov?
    vec3 wPos = vPositionW + data.normalW * shadowParams.y * clamp(1.0 - dot(data.normalW, -data.lightDirNormW), 0.0, 1.0) * distScale;

    _getShadowCoordPersp(data, shadowMatrix, shadowParams, wPos);
}

void getShadowCoordOrthoNormalOffset(inout vsInternalData data, mat4 shadowMatrix, vec3 shadowParams) {
    vec3 wPos = vPositionW + data.normalW * shadowParams.y * clamp(1.0 - dot(data.normalW, -data.lightDirNormW), 0.0, 1.0); //0.08

    _getShadowCoordOrtho(data, shadowMatrix, shadowParams, wPos);
}

