uniform FMEDP vec3 fog_color;
uniform FMEDP float fog_density;
float dBlendModeFogFactor = 1.0;

vec3 addFog(vec3 color) {
    FMEDP float depth = gl_FragCoord.z / gl_FragCoord.w;
    FMEDP float fogFactor = exp(-depth * depth * fog_density * fog_density);
    fogFactor = clamp(fogFactor, 0.0, 1.0);
    return mix(fog_color * dBlendModeFogFactor, color, fogFactor);
}
