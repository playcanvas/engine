uniform vec3 material_specular;
void getSpecularity() {
    dSpecularity = saturate(vVertexColor.$CH) * material_specular;
}

