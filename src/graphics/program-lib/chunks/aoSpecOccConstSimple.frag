void occludeSpecular() {
    MEDP float specOcc = dAo;
    dSpecularLight *= specOcc;
    dReflection *= specOcc;
}
