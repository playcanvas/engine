vec3 gammaCorrectInput(vec3 color) {
    return color * (color * (color * 0.305306011 + 0.682171111) + 0.012522878);
}

float gammaCorrectInput(float color) {
    return color * (color * (color * 0.305306011 + 0.682171111) + 0.012522878);
}

vec4 gammaCorrectInput(vec4 color) {
    return vec4(gammaCorrectInput(color.rgb), color.a);
}

vec4 texture2DSRGB(sampler2D tex, vec2 uv) {
    vec4 rgba = texture2D(tex, uv);
    rgba.rgb = gammaCorrectInput(rgba.rgb);
    return rgba;
}

vec4 textureCubeSRGB(samplerCube tex, vec3 uvw) {
    vec4 rgba = textureCube(tex, uvw);
    rgba.rgb = gammaCorrectInput(rgba.rgb);
    return rgba;
}

vec3 gammaCorrectOutput(vec3 color) {
    color += vec3(0.0000001);
    return pow(color, vec3(0.45));
}

