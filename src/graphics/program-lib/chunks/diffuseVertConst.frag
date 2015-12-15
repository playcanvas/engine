uniform vec3 material_diffuse;
void getAlbedo(inout psInternalData data) {
    data.albedo = gammaCorrectInput(saturate(vVertexColor.$CH)) * material_diffuse;
}

