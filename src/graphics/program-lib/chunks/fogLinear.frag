uniform MEDP vec3 fog_color;
uniform MEDP float fog_start;
uniform MEDP float fog_end;
MEDP float dBlendModeFogFactor = 1.0;

vec3 addFog(vec3 color) {
    MEDP float depth = gl_FragCoord.z / gl_FragCoord.w;
    MEDP float fogFactor = (fog_end - depth) / (fog_end - fog_start);
    fogFactor = clamp(fogFactor, 0.0, 1.0);
    fogFactor = gammaCorrectInput(fogFactor);
    return mix(fog_color * dBlendModeFogFactor, color, fogFactor);
}
