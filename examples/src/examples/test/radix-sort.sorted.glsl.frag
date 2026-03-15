precision highp float;
precision highp usampler2D;

uniform usampler2D sortedIndices;
uniform usampler2D keysTexture;
uniform float elementCount;
uniform float textureWidth;
uniform float maxValue;
uniform vec2 sourceTextureSize;
uniform float debugMode;
varying vec2 vUv0;

void main() {
    vec2 uv = vUv0;

    // Debug mode: show UVs as colors
    if (debugMode > 0.5) {
        gl_FragColor = vec4(uv.x, uv.y, 0.5, 1.0);
        return;
    }

    // Calculate linear index from UV position
    int pixelX = int(uv.x * textureWidth);
    int pixelY = int(uv.y * textureWidth);
    uint linearIdx = uint(pixelY) * uint(textureWidth) + uint(pixelX);

    if (float(linearIdx) >= elementCount) {
        gl_FragColor = vec4(0.2, 0.2, 0.2, 1.0);
        return;
    }

    // Get the original index at this sorted position (linear layout)
    uint tw = uint(textureWidth);
    uint origIdx = texelFetch(sortedIndices, ivec2(linearIdx % tw, linearIdx / tw), 0).r;

    // Convert original index to source texture coordinates
    int srcX = int(origIdx) % int(sourceTextureSize.x);
    int srcY = int(origIdx) / int(sourceTextureSize.x);

    // Look up the key value from the source texture
    float value = float(texelFetch(keysTexture, ivec2(srcX, srcY), 0).r);
    float normalized = value / maxValue;

    // Use same color scheme as unsorted view: blue (low) to red (high)
    vec3 color = mix(vec3(0.1, 0.2, 0.8), vec3(0.9, 0.3, 0.1), normalized);
    gl_FragColor = vec4(color, 1.0);
}

