export default /* glsl */`
vec3 combineColor(LitShaderArguments litShaderArgs) {
    vec3 ret = vec3(0);
#ifdef LIT_OLD_AMBIENT
    ret += (dDiffuseLight - light_globalAmbient) * litShaderArgs.albedo + material_ambient * light_globalAmbient;
#else
    ret += litShaderArgs.albedo * dDiffuseLight;
#endif
#ifdef LIT_SPECULAR
    ret += dSpecularLight;
#endif
#ifdef LIT_REFLECTIONS
    ret += dReflection.rgb * dReflection.a;
#endif

#ifdef LIT_SHEEN
    float sheenScaling = 1.0 - max(max(litShaderArgs.sheenSpecularity.r, litShaderArgs.sheenSpecularity.g), litShaderArgs.sheenSpecularity.b) * 0.157;
    ret = ret * sheenScaling + (sSpecularLight + sReflection.rgb) * litShaderArgs.sheenSpecularity;
#endif
#ifdef LIT_CLEARCOAT
    float clearCoatScaling = 1.0 - ccFresnel * litShaderArgs.clearcoatSpecularity;
    ret = ret * clearCoatScaling + (ccSpecularLight + ccReflection.rgb) * litShaderArgs.clearcoatSpecularity;
#endif

    return ret;
}
`;
