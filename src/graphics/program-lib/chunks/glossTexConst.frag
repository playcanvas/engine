uniform sampler2D texture_glossMap;
uniform float material_shininess;
void getGlossiness() {
    dGlossiness = material_shininess * texture2D(texture_glossMap, $UV).$CH + 0.0000001;
}

