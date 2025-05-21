export default /* glsl */`

float dBlendModeFogFactor = 1.0;

#if (FOG != NONE)
    uniform vec3 fog_color;

    #if (FOG == LINEAR)
        uniform float fog_start;
        uniform float fog_end;
    #else
        uniform float fog_density;
    #endif
#endif

float getFogFactor() {

    float depth = gl_FragCoord.z / gl_FragCoord.w;
    float fogFactor = 0.0;

    #if (FOG == LINEAR)
        fogFactor = (fog_end - depth) / (fog_end - fog_start);
    #elif (FOG == EXP)
        fogFactor = exp(-depth * fog_density);
    #elif (FOG == EXP2)
        fogFactor = exp(-depth * depth * fog_density * fog_density);
    #endif

    return clamp(fogFactor, 0.0, 1.0);
}

vec3 addFog(vec3 color) {

    #if (FOG != NONE)
        return mix(fog_color * dBlendModeFogFactor, color, getFogFactor());
    #endif

    return color;
}
`;
