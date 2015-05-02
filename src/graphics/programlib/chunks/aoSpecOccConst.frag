uniform float material_occludeSpecularIntensity;
void occludeSpecular(inout psInternalData data) {
    // fake specular occlusion from AO
    float specOcc = data.ao;
    specOcc = mix(1.0, specOcc, material_occludeSpecularIntensity);
    data.specularLight *= specOcc;
    data.reflection *= specOcc;
}

