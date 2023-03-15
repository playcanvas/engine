export default /* glsl */`
void addLightMap(LitShaderArguments litShaderArgs) {
    if (dot(litShaderArgs.lightmapDir, litShaderArgs.lightmapDir) < 0.0001) {
        dDiffuseLight += litShaderArgs.lightmap;
    } else {
        dLightDirNormW = litShaderArgs.lightmapDir;

        float vlight = saturate(dot(dLightDirNormW, -dVertexNormalW));
        float flight = saturate(dot(dLightDirNormW, -litShaderArgs.worldNormal));
        float nlight = (flight / max(vlight, 0.01)) * 0.5;

        dDiffuseLight += litShaderArgs.lightmap * nlight * 2.0;

        vec3 halfDirW = normalize(-litShaderArgs.lightmapDir + dViewDirW);
        vec3 specularLight = litShaderArgs.lightmap * getLightSpecular(halfDirW, dReflDirW, litShaderArgs.worldNormal, litShaderArgs.gloss);

#ifdef LIT_SPECULAR_FRESNEL
        specularLight *= getFresnel(dot(dViewDirW, halfDirW), litShaderArgs.gloss, litShaderArgs.specularity, litShaderArgs.iridescence);
#endif

        dSpecularLight += specularLight;
    }
}
`;
