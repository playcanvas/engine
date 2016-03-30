uniform vec3 material_diffuse;
void getAlbedo() {
    dAlbedo = gammaCorrectInput(saturate(vVertexColor.$CH)) * material_diffuse;
}

