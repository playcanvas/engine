uniform MEDP float material_occludeSpecularIntensity;

void occludeSpecular() {
    MEDP float specOcc = mix(1.0, dAo, material_occludeSpecularIntensity);
    dSpecularLight *= specOcc;
    dReflection *= specOcc;
}
