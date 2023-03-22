export default /* glsl */`
uniform float material_occludeSpecularIntensity;

void occludeSpecular(float gloss, float ao, vec3 worldNormal, vec3 viewDir) {
    float specOcc = mix(1.0, ao, material_occludeSpecularIntensity);
    dSpecularLight *= specOcc;
    dReflection *= specOcc;

#ifdef LIT_SHEEN
    sSpecularLight *= specOcc;
    sReflection *= specOcc;
#endif
}
`;
