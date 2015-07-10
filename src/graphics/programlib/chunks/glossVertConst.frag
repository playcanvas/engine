uniform float material_shininess;
void getGlossiness(inout psInternalData data) {
    data.glossiness = material_shininess * saturate(vVertexColor.$CH) + 0.0000001;
}

