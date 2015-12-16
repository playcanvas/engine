uniform float material_opacity;
void getOpacity(inout psInternalData data) {
    data.alpha = material_opacity;
}

