uniform sampler2D texture_lightMap;
void addLightMap() {
    dDiffuseLight += $texture2DSAMPLE(texture_lightMap, $UV).$CH;
}

