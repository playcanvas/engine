void applyAO(inout psInternalData data) {
    data.ao = saturate(vVertexColor.$CH);
    data.diffuseLight *= data.ao;
}

void occludeSpecular(inout psInternalData data) {
    // fake specular occlusion from AO
    float specOcc = data.ao;
    data.specularLight *= specOcc;
    data.reflection *= specOcc;
}
