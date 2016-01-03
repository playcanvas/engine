void getOpacity(inout psInternalData data) {
    data.alpha = saturate(vVertexColor.$CH);
}

