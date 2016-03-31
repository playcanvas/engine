uniform sampler2D texture_opacityMap;
uniform float material_opacity;
void getOpacity() {
    dAlpha = texture2D(texture_opacityMap, $UV).$CH * material_opacity;
}

