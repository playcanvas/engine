void normalOffsetPointShadow(vec4 shadowParams) {
    float distScale = length(dLightDirW);
    vec3 wPos = vPositionW + dVertexNormalW * shadowParams.y * clamp(1.0 - dot(dVertexNormalW, -dLightDirNormW), 0.0, 1.0) * distScale; //0.02
    vec3 dir = wPos - dLightPosW;
    dLightDirW = dir;
}

