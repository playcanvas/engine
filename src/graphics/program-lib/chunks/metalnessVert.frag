void getSpecularity(inout psInternalData data) {
    processMetalness(data, saturate(vVertexColor.$CH));
}

