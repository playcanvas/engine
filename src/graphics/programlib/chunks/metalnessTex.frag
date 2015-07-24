uniform sampler2D texture_metalnessMap;
void getSpecularity(inout psInternalData data) {
    processMetalness(data, texture2D(texture_metalnessMap, $UV).$CH);
}

