export default /* glsl */`
void addLightMap(vec3 lightmap, vec3 dir, vec3 worldNormal, vec3 viewDir, float gloss, vec3 specularity, IridescenceArgs iridescence) {
    if (dot(dir, dir) < 0.0001) {
        dDiffuseLight += lightmap;
    } else {
        dLightDirNormW = dir;

        float vlight = saturate(dot(dLightDirNormW, -dVertexNormalW));
        float flight = saturate(dot(dLightDirNormW, -worldNormal));
        float nlight = (flight / max(vlight, 0.01)) * 0.5;

        dDiffuseLight += lightmap * nlight * 2.0;

        vec3 halfDirW = normalize(-dir + viewDir);
        vec3 specularLight = lightmap * getLightSpecular(halfDirW, dReflDirW, viewDir, worldNormal, gloss);

#ifdef LIT_SPECULAR_FRESNEL
        specularLight *= getFresnel(dot(viewDir, halfDirW), gloss, specularity, iridescence);
#endif

        dSpecularLight += specularLight;
    }
}
`;
