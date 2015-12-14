uniform sampler2D texture_specularMap;
void getSpecularity(inout psInternalData data) {
    data.specularity = texture2D(texture_specularMap, $UV).$CH;
}

