uniform sampler2D texture_metalnessMap;
uniform float material_metalness;
void getSpecularity() {
    processMetalness(texture2D(texture_metalnessMap, $UV).$CH * material_metalness);
}

