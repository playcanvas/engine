uniform vec3 material_specular;
void getSpecularity(inout psInternalData data) {
    data.specularity = saturate(vVertexColor.$CH) * material_specular;
}

