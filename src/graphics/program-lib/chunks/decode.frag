vec3 decodeLinear(vec4 source) {
    return source.rgb;
}

vec3 decodeGamma(vec4 source) {
    return pow(source.xyz, vec3(2.2));
}

vec3 decodeRGBM(vec4 rgbm) {
    vec3 color = (8.0 * rgbm.a) * rgbm.rgb;
    return color * color;
}

vec3 decodeRGBE(vec4 source) {
    if (source.a == 0.0) {
        return vec3(0.0, 0.0, 0.0);
    } else {
        return source.xyz * pow(2.0, source.w * 255.0 - 128.0);
    }
}
