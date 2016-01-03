uniform vec3 material_emissive;
vec3 getEmission(inout psInternalData data) {
    return gammaCorrectInput(saturate(vVertexColor.$CH)) * material_emissive;
}

