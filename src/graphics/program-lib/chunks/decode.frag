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

float PI = 3.141592653589793;

vec2 toSpherical(vec3 dir) {
    return vec2(atan(dir.z, dir.x), asin(dir.y));
}

vec2 toSphericalUv(vec3 dir) {
    vec2 uv = toSpherical(dir) / vec2(PI * 2.0, PI) + 0.5;
    return vec2(uv.x, 1.0 - uv.y);
}

vec2 mapUv(vec2 uv, vec4 rect) {
    return vec2(mix(rect.x, rect.x + rect.z, uv.x),
                mix(rect.y, rect.y + rect.w, uv.y));
}
