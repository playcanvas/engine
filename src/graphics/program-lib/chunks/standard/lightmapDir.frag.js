export default /* glsl */`
uniform sampler2D texture_lightMap;
uniform sampler2D texture_dirLightMap;

void getLightMap() {
    dLightmap = $texture2DSAMPLE(texture_lightMap, $UV).$CH;
    dLightmapDir = texture2D(texture_dirLightMap, $UV).xyz;
}
`;
