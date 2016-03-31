uniform sampler2D texture_opacityMap;
void getOpacity() {
    dAlpha = texture2D(texture_opacityMap, $UV).$CH;
}

