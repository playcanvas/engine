export default /* glsl */`
vec3 combineColor() {
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
#ifdef LIT_CLEARCOAT
    ret += ccSpecularLight + ccReflection.rgb * ccReflection.a;
#endif
#ifdef LIT_SHEEN
    float scaling = 1.0 - max(max(sSpecularity.r, sSpecularity.g), sSpecularity.b) * 0.157;
    ret = ret * scaling + sSpecularLight + sReflection.rgb * sReflection.a;
#endif
    return ret;
}
`;
