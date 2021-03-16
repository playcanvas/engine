void occludeSpecular() {
    OMEDP float specOcc = dAo;
    dSpecularLight *= specOcc;
    dReflection *= specOcc;
}
