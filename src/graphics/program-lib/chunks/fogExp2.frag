uniform MEDP vec3 fog_color;
uniform MEDP float fog_density;
float dBlendModeFogFactor = 1.0;

vec3 addFog(vec3 color) {
    MEDP float depth = gl_FragCoord.z / gl_FragCoord.w;
    MEDP float fogFactor = exp(-depth * depth * fog_density * fog_density);
    fogFactor = clamp(fogFactor, 0.0, 1.0);
    return mix(fog_color * dBlendModeFogFactor, color, fogFactor);
}
