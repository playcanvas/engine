vec4 texture2DSRGB(sampler2D tex, vec2 uv) {
    return texture2D(tex, uv);
}

vec4 texture2DSRGB(sampler2D tex, vec2 uv, float bias) {
    return texture2D(tex, uv, bias);
}

vec4 textureCubeSRGB(samplerCube tex, vec3 uvw) {
    return textureCube(tex, uvw);
}

vec3 gammaCorrectOutput(vec3 color) {
    return color;
}

vec3 gammaCorrectInput(vec3 color) {
    return color;
}

float gammaCorrectInput(float color) {
    return color;
}

vec4 gammaCorrectInput(vec4 color) {
    return color;
}
