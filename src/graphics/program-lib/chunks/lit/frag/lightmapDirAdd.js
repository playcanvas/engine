export default /* glsl */`
void addLightMap() {
    if (dot(dLightmapDir, dLightmapDir) < 0.0001) {
        dDiffuseLight += dLightmap;
    } else {
        dLightDirNormW = dLightmapDir;

        float vlight = saturate(dot(dLightDirNormW, -dVertexNormalW));
        float flight = saturate(dot(dLightDirNormW, -dNormalW));
        float nlight = (flight / max(vlight, 0.01)) * 0.5;

        vec3 halfDirW = normalize(-dLightmapDir + dViewDirW);

        dDiffuseLight += dLightmap * nlight * 2.0;
        dSpecularLight += dLightmap * getLightSpecular(halfDirW) * getFresnel(dot(dViewDirW, halfDirW), dSpecularity);
    }
}
`;
