uniform sampler2D texture_msdfMap;

float median(float r, float g, float b) {
    return max(min(r, g), min(max(r, g), b));
}

vec4 applyMsdf(vec4 color) {

    vec3 tsample = texture2D(texture_msdfMap, vUv0).rgb;
    float distance = median(tsample.r, tsample.g, tsample.b) - 0.5;

    vec4 msdf;

    #ifdef GL_OES_standard_derivatives
    vec4 background = vec4(0.0);

    float opacity = clamp(distance/fwidth(distance) + 0.5, 0.0, 1.0);

    msdf = mix(background, color, opacity);
    if (msdf.a < 0.01) {
        discard;
    }
    #else
    msdf = color;
    if (distance < 0.1) {
        discard;
    }
    #endif

    return msdf;
}
