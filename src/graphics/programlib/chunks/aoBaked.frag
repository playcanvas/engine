uniform sampler2D texture_aoMap;
void applyAO(inout psInternalData data) {
    data.ao = texture2D(texture_aoMap, $UV).$CH;
    data.diffuseLight *= data.ao;
}

void occludeSpecular(inout psInternalData data) {
    // fake specular occlusion from AO
    float specPow = exp2(data.glossiness * 4.0);
    specPow = max(specPow, 0.0001);
    float specOcc = saturate(pow(data.ao * (data.glossiness + 1.0), specPow));

    data.specularLight *= specOcc;
    data.reflection *= specOcc;
}

