export default /* glsl */`
void addLightMap() {
    if (dot(dLightmapDir, vec3(1.0)) < 0.00001) {
        dDiffuseLight += dLightmap;
    } else {
        dLightDirNormW = normalize(dLightmapDir * 2.0 - vec3(1.0));

        float vlight = saturate(dot(dLightDirNormW, -dVertexNormalW));
        float flight = saturate(dot(dLightDirNormW, -dNormalW));
        float nlight = (flight / max(vlight, 0.01)) * 0.5;

        dDiffuseLight += dLightmap * nlight * 2.0;
    }
    vec3 halfDir = normalize(normalize(-dLightDirNormW) + normalize(dViewDirW));
    dSpecularLight += dLightmap * getLightSpecular(halfDir);
}
`;
