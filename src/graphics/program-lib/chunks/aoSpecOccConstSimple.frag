void occludeSpecular() {
    float specOcc = dAo;
    dSpecularLight *= specOcc;
    dReflection *= specOcc;
}

