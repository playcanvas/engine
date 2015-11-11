void occludeSpecular(inout psInternalData data) {
    float specOcc = data.ao;
    data.specularLight *= specOcc;
    data.reflection *= specOcc;
}

