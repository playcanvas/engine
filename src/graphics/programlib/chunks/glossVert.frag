void getGlossiness(inout psInternalData data) {
    data.glossiness = saturate(vVertexColor.$CH) + 0.0000001;
}

