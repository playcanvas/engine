export default /* glsl */`
vec3 decodeLinear(vec4 raw) {
    return raw.rgb;
}

vec3 decodeGamma(vec4 raw) {
    return pow(raw.xyz, vec3(2.2));
}

vec3 decodeRGBM(vec4 raw) {
    vec3 color = (8.0 * raw.a) * raw.rgb;
    return color * color;
}

vec3 decodeRGBE(vec4 raw) {
    if (raw.a == 0.0) {
        return vec3(0.0, 0.0, 0.0);
    } else {
        return raw.xyz * pow(2.0, raw.w * 255.0 - 128.0);
    }
}
`;
