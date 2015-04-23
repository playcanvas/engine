void getGlossiness(inout psInternalData data) {
    data.glossiness = saturate(vVertexColor.$CH);
}

