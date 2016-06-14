precision highp float;

#extension GL_OES_standard_derivatives : enable

varying vec2 vUv0;

uniform sampler2D texture_atlas;
uniform vec4 material_background;
uniform vec4 material_foreground;

float median(float r, float g, float b) {
    return max(min(r, g), min(max(r, g), b));
}

void main() {
    vec3 sample = texture2D(texture_atlas, vUv0).rgb;
    float sigDist = median(sample.r, sample.g, sample.b) - 0.5;
    float opacity = clamp(sigDist/fwidth(sigDist) + 0.5, 0.0, 1.0);
    vec4 c = mix(material_background, material_foreground, opacity);

    if (c.a < 0.01) {
        discard;
    }

    gl_FragColor = c;
}
