uniform float material_opacity;
void getOpacity() {
    dAlpha = saturate(vVertexColor.$CH) * material_opacity;
}

