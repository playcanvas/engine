export default /* glsl */`
void _getShadowCoordOrtho(mat4 shadowMatrix, vec3 shadowParams, vec3 wPos) {
    dShadowCoord = (shadowMatrix * vec4(wPos, 1.0)).xyz;
    dShadowCoord.z = saturate(dShadowCoord.z) - 0.0001;

    #ifdef SHADOWBIAS
    dShadowCoord.z += getShadowBias(shadowParams.x, shadowParams.z);
    #endif
}

void _getShadowCoordPersp(mat4 shadowMatrix, vec4 shadowParams, vec3 wPos, vec3 lightDir) {
    vec4 projPos = shadowMatrix * vec4(wPos, 1.0);
    projPos.xy /= projPos.w;
    dShadowCoord.xy = projPos.xy;
    dShadowCoord.z = length(lightDir) * shadowParams.w;

    #ifdef SHADOWBIAS
    dShadowCoord.z += getShadowBias(shadowParams.x, shadowParams.z);
    #endif
}

void getShadowCoordOrtho(mat4 shadowMatrix, vec3 shadowParams) {
    _getShadowCoordOrtho(shadowMatrix, shadowParams, vPositionW);
}

void getShadowCoordPersp(mat4 shadowMatrix, vec4 shadowParams, vec3 lightPos, vec3 lightDir) {
    _getShadowCoordPersp(shadowMatrix, shadowParams, vPositionW, lightDir);
}

void getShadowCoordPerspNormalOffset(mat4 shadowMatrix, vec4 shadowParams, vec3 lightPos, vec3 lightDir, vec3 lightDirNorm, vec3 normal) {
    float distScale = abs(dot(vPositionW - lightPos, lightDirNorm)); // fov?
    vec3 wPos = vPositionW + normal * shadowParams.y * clamp(1.0 - dot(normal, -lightDirNorm), 0.0, 1.0) * distScale;

    _getShadowCoordPersp(shadowMatrix, shadowParams, wPos, lightDir);
}

void getShadowCoordOrthoNormalOffset(mat4 shadowMatrix, vec3 shadowParams, vec3 lightPos, vec3 lightDir, vec3 lightDirNorm, vec3 normal) {
    vec3 wPos = vPositionW + normal * shadowParams.y * clamp(1.0 - dot(normal, -lightDirNorm), 0.0, 1.0); //0.08

    _getShadowCoordOrtho(shadowMatrix, shadowParams, wPos);
}
`;
