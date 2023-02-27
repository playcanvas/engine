export default /* glsl */`
void addLightMap(Frontend frontend) {
    if (dot(frontend.lightmapDir, frontend.lightmapDir) < 0.0001) {
        dDiffuseLight += frontend.lightmap;
    } else {
        dLightDirNormW = frontend.lightmapDir;

        float vlight = saturate(dot(dLightDirNormW, -dVertexNormalW));
        float flight = saturate(dot(dLightDirNormW, -frontend.worldNormal));
        float nlight = (flight / max(vlight, 0.01)) * 0.5;

        dDiffuseLight += frontend.lightmap * nlight * 2.0;

        vec3 halfDirW = normalize(-frontend.lightmapDir + dViewDirW);
        vec3 specularLight = frontend.lightmap * getLightSpecular(halfDirW);

        #ifdef LIT_SPECULAR_FRESNEL
        specularLight *= getFresnel(dot(dViewDirW, halfDirW), frontend);
        #endif

        dSpecularLight += specularLight;
    }
}
`;
