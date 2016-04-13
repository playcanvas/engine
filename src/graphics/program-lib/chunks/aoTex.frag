uniform sampler2D texture_aoMap;
void applyAO() {
    dAo = texture2D(texture_aoMap, $UV).$CH;
    dDiffuseLight *= dAo;
}

