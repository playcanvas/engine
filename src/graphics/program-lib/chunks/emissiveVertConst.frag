uniform vec3 material_emissive;
vec3 getEmission() {
    return gammaCorrectInput(saturate(vVertexColor.$CH)) * material_emissive;
}

