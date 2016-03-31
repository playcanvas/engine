vec3 getEmission() {
    return gammaCorrectInput(saturate(vVertexColor.$CH));
}

