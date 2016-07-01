uniform float material_emissiveIntensity;
vec3 getEmission() {
    return gammaCorrectInput(saturate(vVertexColor.$CH)) * material_emissiveIntensity;
}

