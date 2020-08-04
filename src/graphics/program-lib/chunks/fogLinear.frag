uniform vec3 fog_color;
uniform float fog_start;
uniform float fog_end;
float d_fog_factor=1.0; //for additive blend, this should be 0.0
vec3 addFog(vec3 color) {
    float depth = gl_FragCoord.z / gl_FragCoord.w;
    float fogFactor = (fog_end - depth) / (fog_end - fog_start);
    fogFactor = clamp(fogFactor, 0.0, 1.0);
    fogFactor = gammaCorrectInput(fogFactor);
    return mix(fog_color*d_fog_factor, color, fogFactor);
}
