uniform float material_occludeSpecularIntensity;
void occludeSpecular(inout psInternalData data) {
    float specOcc = mix(1.0, data.ao, material_occludeSpecularIntensity);
    data.specularLight *= specOcc;
    data.reflection *= specOcc;
}

