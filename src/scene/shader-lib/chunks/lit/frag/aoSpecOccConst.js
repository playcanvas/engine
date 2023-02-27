export default /* glsl */`
void occludeSpecular(Frontend frontend) {
    // approximated specular occlusion from AO
    float specPow = exp2(frontend.glossiness * 11.0);
    // http://research.tri-ace.com/Data/cedec2011_RealtimePBR_Implementation_e.pptx
    float specOcc = saturate(pow(dot(frontend.worldNormal, dViewDirW) + dAo, 0.01*specPow) - 1.0 + frontend.ao);

    dSpecularLight *= specOcc;
    dReflection *= specOcc;
    
#ifdef LIT_SHEEN
    sSpecularLight *= specOcc;
    sReflection *= specOcc;
#endif
}
`;
