export default /* glsl */`

#if LIT_OCCLUDE_SPECULAR != NONE
    #ifdef LIT_OCCLUDE_SPECULAR_FLOAT
        uniform float material_occludeSpecularIntensity;
    #endif
#endif

void occludeSpecular(float gloss, float ao, vec3 worldNormal, vec3 viewDir) {

    #if LIT_OCCLUDE_SPECULAR == AO
        #ifdef LIT_OCCLUDE_SPECULAR_FLOAT
            float specOcc = mix(1.0, ao, material_occludeSpecularIntensity);
        #else
            float specOcc = ao;
        #endif
    #endif

    #if LIT_OCCLUDE_SPECULAR == GLOSSDEPENDENT

        // approximated specular occlusion from AO
        // http://research.tri-ace.com/Data/cedec2011_RealtimePBR_Implementation_e.pptx
        float specPow = exp2(gloss * 11.0);
        float specOcc = saturate(pow(dot(worldNormal, viewDir) + ao, 0.01 * specPow) - 1.0 + ao);

        #ifdef LIT_OCCLUDE_SPECULAR_FLOAT
            specOcc = mix(1.0, specOcc, material_occludeSpecularIntensity);
        #endif
    #endif

    #if LIT_OCCLUDE_SPECULAR != NONE
        dSpecularLight *= specOcc;
        dReflection *= specOcc;

        #ifdef LIT_SHEEN
            sSpecularLight *= specOcc;
            sReflection *= specOcc;
        #endif
    #endif
}
`;
