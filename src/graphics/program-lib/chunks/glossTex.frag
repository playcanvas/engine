uniform sampler2D texture_glossMap;
void getGlossiness() {
    dGlossiness = texture2D(texture_glossMap, $UV).$CH + 0.0000001;
}

