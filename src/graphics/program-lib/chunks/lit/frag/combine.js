export default /* glsl */`
vec3 combineColor() {
    vec3 ret = vec3(0, 0, 0);
#ifdef COMBINE_OLD_AMBIENT
    ret += (dDiffuseLight - light_globalAmbient) * dAlbedo + material_ambient * light_globalAmbient;
#else
    ret += dAlbedo * dDiffuseLight;
#endif
#ifdef COMBINE_SPECULAR
    ret += dSpecularLight;
#endif
#ifdef COMBINE_REFLECTIONS
    ret += dReflection.rgb * dReflection.a;
#endif
#ifdef COMBINE_CLEARCOAT
    ret += ccSpecularLight + ccReflection.rgb * ccReflection.a;
#endif
    return ret;
}
`;
