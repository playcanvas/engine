void _getShadowCoordOrtho(mat4 shadowMatrix, vec3 shadowParams, vec3 wPos) {
    dShadowCoord = (shadowMatrix * vec4(wPos, 1.0)).xyz;
    dShadowCoord.z += getShadowBias(shadowParams.x, shadowParams.z);
    //dShadowCoord.z = min(dShadowCoord.z, 1.0);
}

void _getShadowCoordPersp(mat4 shadowMatrix, vec4 shadowParams, vec3 wPos) {
    vec4 projPos = shadowMatrix * vec4(wPos, 1.0);
    projPos.xy /= projPos.w;
    dShadowCoord.xy = projPos.xy;
    dShadowCoord.z = projPos.z / projPos.w;//length(dLightDirW) * shadowParams.w;

    //dShadowCoord.z = length(dLightDirW) * shadowParams.w;
    //dShadowCoord.z += getShadowBias(shadowParams.x, shadowParams.z);
    float f = 1.0 / shadowParams.w;
    float n = f / 1000.0;

    //dShadowCoord.z = (2.0*n) / (f + n - dShadowCoord.z * (f - n)); // linearize


    dShadowCoord.z = -((2.0*f*n)/(f-n)) / (dShadowCoord.z - (f+n)/(f-n)); // linearize
    dShadowCoord.z *= shadowParams.w;
    dShadowCoord.z += getShadowBias(shadowParams.x, shadowParams.z) * 10.0;
    dShadowCoord.z /= shadowParams.w;
    dShadowCoord.z = (f+n)/(f-n) - (2.0*f*n)/(f-n) / dShadowCoord.z; // unlinearize
}

void getShadowCoordOrtho(mat4 shadowMatrix, vec3 shadowParams) {
    _getShadowCoordOrtho(shadowMatrix, shadowParams, vPositionW);
}

void getShadowCoordPersp(mat4 shadowMatrix, vec4 shadowParams) {
    _getShadowCoordPersp(shadowMatrix, shadowParams, vPositionW);
}

void getShadowCoordPerspNormalOffset(mat4 shadowMatrix, vec4 shadowParams) {
    float distScale = abs(dot(vPositionW - dLightPosW, dLightDirNormW)); // fov?
    vec3 wPos = vPositionW + vNormalW * shadowParams.y * clamp(1.0 - dot(vNormalW, -dLightDirNormW), 0.0, 1.0) * distScale;

    _getShadowCoordPersp(shadowMatrix, shadowParams, wPos);
}

void getShadowCoordOrthoNormalOffset(mat4 shadowMatrix, vec3 shadowParams) {
    vec3 wPos = vPositionW + vNormalW * shadowParams.y * clamp(1.0 - dot(vNormalW, -dLightDirNormW), 0.0, 1.0); //0.08

    _getShadowCoordOrtho(shadowMatrix, shadowParams, wPos);
}

