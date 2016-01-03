uniform float material_opacity;
void getOpacity(inout psInternalData data) {
    data.alpha = saturate(vVertexColor.$CH) * material_opacity;
}

