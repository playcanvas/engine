vec3 getEmission(inout psInternalData data) {
    return gammaCorrectInput(saturate(vVertexColor.$CH));
}

