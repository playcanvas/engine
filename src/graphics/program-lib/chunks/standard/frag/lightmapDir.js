export default /* glsl */`
uniform sampler2D texture_lightMap;
uniform sampler2D texture_dirLightMap;

void getLightMap() {
    dLightmap = $DECODE(texture2D(texture_lightMap, $UV, textureBias)).$CH;
    dLightmapDir = texture2D(texture_dirLightMap, $UV).xyz;
}
`;
