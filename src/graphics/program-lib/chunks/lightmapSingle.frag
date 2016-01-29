uniform sampler2D texture_lightMap;
void addLightMap(inout psInternalData data) {
    data.diffuseLight += $texture2DSAMPLE(texture_lightMap, $UV).$CH;
}

