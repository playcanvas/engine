export default /* wgsl */`
fn combineColor(albedo: vec3f, sheenSpecularity: vec3f, clearcoatSpecularity: f32) -> vec3f {
    var ret: vec3f = vec3f(0.0);

    #ifdef LIT_OLD_AMBIENT
        ret = ret + ((dDiffuseLight - uniform.light_globalAmbient) * albedo + uniform.material_ambient * uniform.light_globalAmbient);
    #else
        ret = ret + (albedo * dDiffuseLight);
    #endif // LIT_OLD_AMBIENT
    #ifdef LIT_SPECULAR
        ret = ret + dSpecularLight;
    #endif // LIT_SPECULAR
    #ifdef LIT_REFLECTIONS
        ret = ret + (dReflection.rgb * dReflection.a);
    #endif // LIT_REFLECTIONS

    #ifdef LIT_SHEEN
        let sheenScaling: f32 = 1.0 - max(max(sheenSpecularity.r, sheenSpecularity.g), sheenSpecularity.b) * 0.157;
        ret = ret * sheenScaling + (sSpecularLight + sReflection.rgb) * sheenSpecularity;
    #endif // LIT_SHEEN
    #ifdef LIT_CLEARCOAT
        let clearCoatScaling: f32 = 1.0 - ccFresnel * clearcoatSpecularity;
        ret = ret * clearCoatScaling + (ccSpecularLight + ccReflection) * clearcoatSpecularity;
    #endif // LIT_CLEARCOAT

    return ret;
}
`;
