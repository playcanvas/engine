
#ifdef GL2
#define fog_color uniformScene.fogColor_skyInt.xyz
#define fog_density uniformScene.fogParams.z
#else
uniform vec3 fog_color;
uniform float fog_density;
#endif

vec3 addFog(vec3 color) {
    float depth = gl_FragCoord.z / gl_FragCoord.w;
    float fogFactor = exp(-depth * depth * fog_density * fog_density);
    fogFactor = clamp(fogFactor, 0.0, 1.0);
    return mix(fog_color, color, fogFactor);
}
