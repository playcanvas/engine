uniform FMEDP vec3 fog_color;
uniform FMEDP float fog_start;
uniform FMEDP float fog_end;
FMEDP float dBlendModeFogFactor = 1.0;

vec3 addFog(vec3 color) {
    FMEDP float depth = gl_FragCoord.z / gl_FragCoord.w;
    FMEDP float fogFactor = (fog_end - depth) / (fog_end - fog_start);
    fogFactor = clamp(fogFactor, 0.0, 1.0);
    fogFactor = gammaCorrectInput(fogFactor);
    return mix(fog_color * dBlendModeFogFactor, color, fogFactor);
}
