uniform sampler2D texture_aoMap;
void applyAO(inout psInternal) {
    dAo = texture2D(texture_aoMap, $UV).$CH;
    dDiffuseLight *= dAo;
}

