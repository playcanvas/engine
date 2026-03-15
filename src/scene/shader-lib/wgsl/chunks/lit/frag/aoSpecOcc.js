export default /* wgsl */`

#if LIT_OCCLUDE_SPECULAR != NONE
    #ifdef LIT_OCCLUDE_SPECULAR_FLOAT
        uniform material_occludeSpecularIntensity: f32;
    #endif
#endif

fn occludeSpecular(gloss: f32, ao: f32, worldNormal: vec3f, viewDir: vec3f) {

    #if LIT_OCCLUDE_SPECULAR == AO
        #ifdef LIT_OCCLUDE_SPECULAR_FLOAT
            var specOcc: f32 = mix(1.0, ao, uniform.material_occludeSpecularIntensity);
        #else
            var specOcc: f32 = ao;
        #endif
    #endif

    #if LIT_OCCLUDE_SPECULAR == GLOSSDEPENDENT

        // approximated specular occlusion from AO
        // http://research.tri-ace.com/Data/cedec2011_RealtimePBR_Implementation_e.pptx
        var specPow: f32 = exp2(gloss * 11.0);
        var specOcc: f32 = saturate(pow(dot(worldNormal, viewDir) + ao, 0.01 * specPow) - 1.0 + ao);

        #ifdef LIT_OCCLUDE_SPECULAR_FLOAT
            specOcc = mix(1.0, specOcc, uniform.material_occludeSpecularIntensity);
        #endif
    #endif

    #if LIT_OCCLUDE_SPECULAR != NONE
        dSpecularLight = dSpecularLight * specOcc;
        dReflection = dReflection * specOcc;

        #ifdef LIT_SHEEN
            sSpecularLight = sSpecularLight * specOcc;
            sReflection = sReflection * specOcc;
        #endif
    #endif
}
`;
