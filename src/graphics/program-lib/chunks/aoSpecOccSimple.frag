uniform OMEDP float material_occludeSpecularIntensity;

void occludeSpecular() {
    OMEDP float specOcc = mix(1.0, dAo, material_occludeSpecularIntensity);
    dSpecularLight *= specOcc;
    dReflection *= specOcc;
}
