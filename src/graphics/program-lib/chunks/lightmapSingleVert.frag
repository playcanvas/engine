void addAmbient(inout psInternalData data) {
    data.diffuseLight = saturate(vVertexColor.$CH);
}

