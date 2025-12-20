precision highp float;
precision highp usampler2D;
uniform usampler2D keysTexture;
uniform float maxValue;
uniform float elementCount;
uniform vec2 textureSize;
uniform float debugMode;
varying vec2 vUv0;

void main() {
    vec2 uv = vUv0;

    // Debug mode: show UVs as colors
    if (debugMode > 0.5) {
        gl_FragColor = vec4(uv.x, uv.y, 0.0, 1.0);
        return;
    }

    // Scale UV to texture coordinates
    int x = int(uv.x * textureSize.x);
    int y = int(uv.y * textureSize.y);
    int idx = y * int(textureSize.x) + x;

    if (float(idx) >= elementCount) {
        gl_FragColor = vec4(0.2, 0.2, 0.2, 1.0);
        return;
    }

    float value = float(texelFetch(keysTexture, ivec2(x, y), 0).r);
    float normalized = value / maxValue;

    // Color gradient based on value
    vec3 color = mix(vec3(0.1, 0.2, 0.8), vec3(0.9, 0.3, 0.1), normalized);
    gl_FragColor = vec4(color, 1.0);
}

