export default /* wgsl */`
#ifdef STD_NORMAL_TEXTURE
    uniform material_bumpiness: f32;
#endif

#ifdef STD_NORMALDETAIL_TEXTURE
    uniform material_normalDetailMapBumpiness: f32;

    // https://blog.selfshadow.com/publications/blending-in-detail/#detail-oriented
    fn blendNormals(inN1: vec3f, inN2: vec3f) -> vec3f {
        let n1: vec3f = inN1 + vec3f(0.0, 0.0, 1.0);
        let n2: vec3f = inN2 * vec3f(-1.0, -1.0, 1.0);
        return n1 * dot(n1, n2) / n1.z - n2;
    }
#endif

fn getNormal() {
#ifdef STD_NORMAL_TEXTURE
    var normalMap: vec3f = {STD_NORMAL_TEXTURE_DECODE}(textureSampleBias({STD_NORMAL_TEXTURE_NAME}, {STD_NORMAL_TEXTURE_NAME}Sampler, {STD_NORMAL_TEXTURE_UV}, uniform.textureBias));
    normalMap = mix(vec3f(0.0, 0.0, 1.0), normalMap, uniform.material_bumpiness);

    #ifdef STD_NORMALDETAIL_TEXTURE
        var normalDetailMap: vec3f = {STD_NORMALDETAIL_TEXTURE_DECODE}(textureSampleBias({STD_NORMALDETAIL_TEXTURE_NAME}, {STD_NORMALDETAIL_TEXTURE_NAME}Sampler, {STD_NORMALDETAIL_TEXTURE_UV}, uniform.textureBias));
        normalDetailMap = mix(vec3f(0.0, 0.0, 1.0), normalDetailMap, uniform.material_normalDetailMapBumpiness);
        normalMap = blendNormals(normalMap, normalDetailMap);
    #endif

    dNormalW = normalize(dTBN * normalMap);
#else
    dNormalW = dVertexNormalW;
#endif
}
`;
