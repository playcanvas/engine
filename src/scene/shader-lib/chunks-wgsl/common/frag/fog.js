export default /* wgsl */`

#if (FOG != NONE)
    uniform fog_color : vec3f;
    
    #if (FOG == LINEAR)
        uniform fog_start : f32;
        uniform fog_end : f32;
    #else
        uniform fog_density : f32;
    #endif
#endif

uniform dBlendModeFogFactor : f32;

fn getFogFactor() -> f32 {

    // TODO: find a way to do this in WGSL, for now the fog is not working
    // let depth = gl_FragCoord.z / gl_FragCoord.w;
    let depth = 1.0;

    var fogFactor : f32 = 0.0;

    #if (FOG == LINEAR)
        fogFactor = (uniform.fog_end - depth) / (uniform.fog_end - uniform.fog_start);
    #elif (FOG == EXP)
        fogFactor = exp(-depth * uniform.fog_density);
    #elif (FOG == EXP2)
        fogFactor = exp(-depth * depth * uniform.fog_density * uniform.fog_density);
    #endif

    return clamp(fogFactor, 0.0, 1.0);
}

fn addFog(color : vec3f) -> vec3f {
    #if (FOG != NONE)
        return mix(uniform.fog_color * uniform.dBlendModeFogFactor, color, getFogFactor());
    #else
        return color;
    #endif
}
`;
