uniform sampler2D texture_lightMap;
void addAmbient(inout psInternalData data) {
    data.diffuseLight = texture2D(texture_lightMap, $UV).$CH;
}

