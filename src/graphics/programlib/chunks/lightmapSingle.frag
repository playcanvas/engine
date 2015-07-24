uniform sampler2D texture_lightMap;
void addAmbient(inout psInternalData data) {
    data.diffuseLight = $texture2DSAMPLE(texture_lightMap, $UV).$CH;
}

