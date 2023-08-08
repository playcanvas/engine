export default /* glsl */`
void addLightMap(
    vec3 lightmap, 
    vec3 dir, 
    vec3 worldNormal, 
    vec3 viewDir, 
    vec3 reflectionDir, 
    float gloss, 
    vec3 specularity, 
    vec3 vertexNormal, 
    mat3 tbn
#if defined(LIT_IRIDESCENCE)
    vec3 iridescenceFresnel, 
    IridescenceArgs iridescence
#endif
) {
    if (dot(dir, dir) < 0.0001) {
        dDiffuseLight += lightmap;
    } else {
        float vlight = saturate(dot(dir, -vertexNormal));
        float flight = saturate(dot(dir, -worldNormal));
        float nlight = (flight / max(vlight, 0.01)) * 0.5;

        dDiffuseLight += lightmap * nlight * 2.0;

        vec3 halfDir = normalize(-dir + viewDir);
        vec3 specularLight = lightmap * getLightSpecular(halfDir, reflectionDir, worldNormal, viewDir, dir, gloss, tbn);

#ifdef LIT_SPECULAR_FRESNEL
        specularLight *= 
            getFresnel(dot(viewDir, halfDir), 
            gloss, 
            specularity
        #if defined(LIT_IRIDESCENCE)
            , iridescenceFresnel,
            iridescence
        #endif
            );
#endif

        dSpecularLight += specularLight;
    }
}
`;
