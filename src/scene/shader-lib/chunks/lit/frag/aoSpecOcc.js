export default /* glsl */`
uniform float material_occludeSpecularIntensity;

void occludeSpecular(float gloss, float ao, vec3 worldNormal, vec3 viewDir) {
    // approximated specular occlusion from AO
    float specPow = exp2(gloss * 11.0);
    // http://research.tri-ace.com/Data/cedec2011_RealtimePBR_Implementation_e.pptx
    float specOcc = saturate(pow(dot(worldNormal, viewDir) + ao, 0.01*specPow) - 1.0 + ao);
    specOcc = mix(1.0, specOcc, material_occludeSpecularIntensity);

    dSpecularLight *= specOcc;
    dReflection *= specOcc;
    
#ifdef LIT_SHEEN
    sSpecularLight *= specOcc;
    sReflection *= specOcc;
#endif
}
`;
