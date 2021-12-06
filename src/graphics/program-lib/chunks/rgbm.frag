vec3 texture2DRGBM(sampler2D tex, vec2 uv) {
    return decodeRGBM(texture2D(tex, uv));
}

vec3 textureCubeRGBM(samplerCube tex, vec3 uvw) {
    return decodeRGBM(textureCube(tex, uvw));
}
