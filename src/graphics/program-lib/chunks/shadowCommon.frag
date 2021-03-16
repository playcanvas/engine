void normalOffsetPointShadow(vec4 shadowParams) {
    MEDP float distScale = length(dLightDirW);
    MEDP vec3 wPos = vPositionW + dVertexNormalW * shadowParams.y * clamp(1.0 - dot(dVertexNormalW, -dLightDirNormW), 0.0, 1.0) * distScale; //0.02
    MEDP vec3 dir = wPos - dLightPosW;
    dLightDirW = dir;
}
