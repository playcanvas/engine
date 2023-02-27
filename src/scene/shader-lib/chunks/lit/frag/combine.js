export default /* glsl */`
vec3 combineColor(Frontend frontend) {
    vec3 ret = vec3(0);
#ifdef LIT_OLD_AMBIENT
    ret += (dDiffuseLight - light_globalAmbient) * frontend.albedo + material_ambient * light_globalAmbient;
#else
    ret += frontend.albedo * dDiffuseLight;
#endif
#ifdef LIT_SPECULAR
    ret += dSpecularLight;
#endif
#ifdef LIT_REFLECTIONS
    ret += dReflection.rgb * dReflection.a;
#endif

#ifdef LIT_SHEEN
    float sheenScaling = 1.0 - max(max(frontend.sheenSpecularity.r, frontend.sheenSpecularity.g), frontend.sheenSpecularity.b) * 0.157;
    ret = ret * sheenScaling + (sSpecularLight + sReflection.rgb) * frontend.sheenSpecularity;
#endif
#ifdef LIT_CLEARCOAT
    float clearCoatScaling = 1.0 - ccFresnel * frontend.clearcoatSpecularity;
    ret = ret * clearCoatScaling + (ccSpecularLight + ccReflection.rgb) * frontend.clearcoatSpecularity;
#endif

    return ret;
}
`;
