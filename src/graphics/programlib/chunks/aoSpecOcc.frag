uniform float material_occludeSpecularContrast;
uniform float material_occludeSpecularIntensity;
void occludeSpecular(inout psInternalData data) {
    // fake specular occlusion from AO
    float specPow = exp2(data.glossiness * 4.0); // 0 - 128
    specPow = max(specPow, 0.0001);
    float specOcc = saturate(pow(data.ao * (data.glossiness + 1.0), specPow));

    specOcc = mix(data.ao, specOcc, material_occludeSpecularContrast);
    specOcc = mix(1.0, specOcc, material_occludeSpecularIntensity);

    data.specularLight *= specOcc;
    data.reflection *= specOcc;
}

