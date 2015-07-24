uniform sampler2D texture_aoMap;
void applyAO(inout psInternalData data) {
    data.ao = texture2D(texture_aoMap, $UV).$CH;
    data.diffuseLight *= data.ao;
}

