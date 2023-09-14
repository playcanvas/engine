export default /* glsl */`
vec3 combineColor(vec3 albedo, vec3 sheenSpecularity, float clearcoatSpecularity) {
    vec3 ret = vec3(0);
#ifdef LIT_OLD_AMBIENT
    ret += (dDiffuseLight - light_globalAmbient) * albedo + material_ambient * light_globalAmbient;
#else
    ret += albedo * dDiffuseLight;
#endif
#ifdef LIT_SPECULAR
    ret += dSpecularLight;
#endif
#ifdef LIT_REFLECTIONS
    ret += dReflection.rgb * dReflection.a;
#endif

#ifdef LIT_SHEEN
    float sheenScaling = 1.0 - max(max(sheenSpecularity.r, sheenSpecularity.g), sheenSpecularity.b) * 0.157;
    ret = ret * sheenScaling + (sSpecularLight + sReflection.rgb) * sheenSpecularity;
#endif
#ifdef LIT_CLEARCOAT
    float clearCoatScaling = 1.0 - ccFresnel * clearcoatSpecularity;
    ret = ret * clearCoatScaling + (ccSpecularLight + ccReflection.rgb) * clearcoatSpecularity;
#endif

    return ret;
}
`;
