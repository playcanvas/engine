uniform sampler2D texture_specularMap;
void getSpecularity() {
    dSpecularity = texture2D(texture_specularMap, $UV).$CH;
}

