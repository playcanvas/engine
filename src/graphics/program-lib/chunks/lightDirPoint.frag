void getLightDirPoint(inout psInternalData data, vec3 lightPosW) {
    data.lightDirW = vPositionW - lightPosW;
    data.lightDirNormW = normalize(data.lightDirW);
    data.lightPosW = lightPosW;
}

