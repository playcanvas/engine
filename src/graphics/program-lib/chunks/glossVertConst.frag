uniform float material_shininess;
void getGlossiness() {
    dGlossiness = material_shininess * saturate(vVertexColor.$CH) + 0.0000001;
}

