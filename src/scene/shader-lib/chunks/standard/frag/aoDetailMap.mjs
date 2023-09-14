export default /* glsl */`
float addAoDetail(float ao) {
#ifdef MAPTEXTURE
    float aoDetail = texture2DBias($SAMPLER, $UV, textureBias).$CH;
    return detailMode_$DETAILMODE(vec3(ao), vec3(aoDetail)).r;
#else
    return ao;
#endif
}
`;
