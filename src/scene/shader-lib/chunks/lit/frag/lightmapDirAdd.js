export default /* glsl */`
void addLightMap() {
    if (dot(dLightmapDir, dLightmapDir) < 0.0001) {
        dDiffuseLight += dLightmap;
    } else {
        dLightDirNormW = dLightmapDir;

        float vlight = saturate(dot(dLightDirNormW, -dVertexNormalW));
        float flight = saturate(dot(dLightDirNormW, -dNormalW));
        float nlight = (flight / max(vlight, 0.01)) * 0.5;

        dDiffuseLight += dLightmap * nlight * 2.0;

        vec3 halfDirW = normalize(-dLightmapDir + dViewDirW);
        vec3 specularLight = dLightmap * getLightSpecular(halfDirW);

        #ifdef LIT_SPECULAR_FRESNEL
        specularLight *= getFresnel(dot(dViewDirW, halfDirW), dSpecularity);
        #endif

        dSpecularLight += specularLight;
    }
}
`;
