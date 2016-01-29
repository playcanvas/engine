void addLightMap(inout psInternalData data) {
    data.diffuseLight += saturate(vVertexColor.$CH);
}

