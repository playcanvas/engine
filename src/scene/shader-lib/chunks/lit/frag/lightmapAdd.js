export default /* glsl */`
void addLightMap(vec3 lightmap, vec3 dir, vec3 worldNormal, float gloss, vec3 specularity, IridescenceArgs iridescence) {
    dDiffuseLight += lightmap;
}
`;
