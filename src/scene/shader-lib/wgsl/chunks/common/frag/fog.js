export default /* wgsl */`

var<private> dBlendModeFogFactor : f32 = 1.0;

#if (FOG != NONE)
    uniform fog_color : vec3f;
    
    #if (FOG == LINEAR)
        uniform fog_start : f32;
        uniform fog_end : f32;
    #else
        uniform fog_density : f32;
    #endif
#endif

fn getFogFactor() -> f32 {

    let depth = pcPosition.z / pcPosition.w;

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
        return mix(uniform.fog_color * dBlendModeFogFactor, color, getFogFactor());
    #else
        return color;
    #endif
}
`;
