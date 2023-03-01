export default /* glsl */`
uniform float material_occludeSpecularIntensity;

void occludeSpecular(LitShaderArguments litShaderArgs) {
    // approximated specular occlusion from AO
    float specPow = exp2(litShaderArgs.gloss * 11.0);
    // http://research.tri-ace.com/Data/cedec2011_RealtimePBR_Implementation_e.pptx
    float specOcc = saturate(pow(dot(litShaderArgs.worldNormal, dViewDirW) + dAo, 0.01*specPow) - 1.0 + litShaderArgs.ao);
    specOcc = mix(1.0, specOcc, material_occludeSpecularIntensity);

    dSpecularLight *= specOcc;
    dReflection *= specOcc;
    
#ifdef LIT_SHEEN
    sSpecularLight *= specOcc;
    sReflection *= specOcc;
#endif
}
`;
