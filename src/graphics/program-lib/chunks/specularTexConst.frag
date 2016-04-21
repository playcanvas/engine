uniform sampler2D texture_specularMap;
uniform vec3 material_specular;
void getSpecularity() {
    dSpecularity = texture2D(texture_specularMap, $UV).$CH * material_specular;
}

