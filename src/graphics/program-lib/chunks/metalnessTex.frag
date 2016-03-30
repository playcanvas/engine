uniform sampler2D texture_metalnessMap;
void getSpecularity() {
    processMetalness(texture2D(texture_metalnessMap, $UV).$CH);
}

