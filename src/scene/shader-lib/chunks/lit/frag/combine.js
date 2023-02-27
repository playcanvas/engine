export default /* glsl */`
vec3 combineColor(Frontend frontend) {
    vec3 ret = vec3(0);
#ifdef LIT_OLD_AMBIENT
    ret += (dDiffuseLight - light_globalAmbient) * dAlbedo + material_ambient * light_globalAmbient;
#else
    ret += dAlbedo * dDiffuseLight;
#endif
#ifdef LIT_SPECULAR
    ret += dSpecularLight;
#endif
#ifdef LIT_REFLECTIONS
    ret += dReflection.rgb * dReflection.a;
#endif

#ifdef LIT_SHEEN
    float sheenScaling = 1.0 - max(max(frontend.sSpecularity.r, frontend.sSpecularity.g), frontend.sSpecularity.b) * 0.157;
    ret = ret * sheenScaling + (sSpecularLight + sReflection.rgb) * frontend.sSpecularity;
#endif
#ifdef LIT_CLEARCOAT
    float clearCoatScaling = 1.0 - ccFresnel * frontend.ccSpecularity;
    ret = ret * clearCoatScaling + (ccSpecularLight + ccReflection.rgb) * frontend.ccSpecularity;
#endif

    return ret;
}
`;
