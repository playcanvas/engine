export default /* glsl */`
void addLightMap(vec3 lightmap, vec3 dir, vec3 worldNormal, vec3 viewDir, vec3 reflectionDir, float gloss, vec3 specularity, inout vec3 lightDirNorm, vec3 vertexNormal, IridescenceArgs iridescence) {
    dDiffuseLight += lightmap;
}
`;
