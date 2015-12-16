void getSpecularity(inout psInternalData data) {
    data.specularity = saturate(vVertexColor.$CH);
}

