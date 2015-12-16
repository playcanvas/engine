uniform sampler2D texture_glossMap;
void getGlossiness(inout psInternalData data) {
    data.glossiness = texture2D(texture_glossMap, $UV).$CH + 0.0000001;
}

