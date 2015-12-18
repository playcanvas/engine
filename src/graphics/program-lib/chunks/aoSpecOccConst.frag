void occludeSpecular(inout psInternalData data) {
    // approximated specular occlusion from AO
    float specPow = exp2(data.glossiness * 11.0);
    // http://research.tri-ace.com/Data/cedec2011_RealtimePBR_Implementation_e.pptx
    float specOcc = saturate(pow(dot(data.normalW, data.viewDirW) + data.ao, 0.01*specPow) - 1.0 + data.ao);

    data.specularLight *= specOcc;
    data.reflection *= specOcc;
}

