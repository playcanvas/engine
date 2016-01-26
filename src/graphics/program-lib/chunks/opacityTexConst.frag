uniform sampler2D texture_opacityMap;
uniform float material_opacity;
void getOpacity(inout psInternalData data) {
    data.alpha = texture2D(texture_opacityMap, $UV).$CH * material_opacity;
}

