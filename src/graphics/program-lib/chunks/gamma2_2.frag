vec3 gammaCorrectInput(vec3 color) {
    return pow(color, vec3(2.2));
}

float gammaCorrectInput(float color) {
    return pow(color, 2.2);
}

vec4 gammaCorrectInput(vec4 color) {
    return vec4(pow(color.rgb, vec3(2.2)), color.a);
}

vec4 texture2DSRGB(sampler2D tex, vec2 uv) {
    vec4 rgba = texture2D(tex, uv);
    rgba.rgb = gammaCorrectInput(rgba.rgb);
    return rgba;
}

vec4 texture2DSRGB(sampler2D tex, vec2 uv, float bias) {
    vec4 rgba = texture2D(tex, uv, bias);
    rgba.rgb = gammaCorrectInput(rgba.rgb);
    return rgba;
}

vec4 textureCubeSRGB(samplerCube tex, vec3 uvw) {
    vec4 rgba = textureCube(tex, uvw);
    rgba.rgb = gammaCorrectInput(rgba.rgb);
    return rgba;
}

vec3 gammaCorrectOutput(vec3 color) {
#ifdef HDR
    return color;
#else
    color += vec3(0.0000001);
    return pow(color, vec3(0.45));
#endif
}
