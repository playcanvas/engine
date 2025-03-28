export default /* glsl */`
uniform sampler2D texture_lightMap;
uniform sampler2D texture_dirLightMap;

void getLightMap() {
    dLightmap = {STD_LIGHT_TEXTURE_DECODE}(texture2DBias(texture_lightMap, {STD_LIGHT_TEXTURE_UV}, textureBias)).{STD_LIGHT_TEXTURE_CHANNEL};

    vec3 dir = texture2DBias(texture_dirLightMap, {STD_LIGHT_TEXTURE_UV}, textureBias).xyz * 2.0 - 1.0;
    float dirDot = dot(dir, dir);
    dLightmapDir = (dirDot > 0.001) ? dir / sqrt(dirDot) : vec3(0.0);
}
`;
