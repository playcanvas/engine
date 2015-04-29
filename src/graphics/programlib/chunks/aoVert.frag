void applyAO(inout psInternalData data) {
    data.ao = saturate(vVertexColor.$CH);
    data.diffuseLight *= data.ao;
}

