
precision mediump float;
uniform sampler2D uTexture;
varying float vertOutTexCoord;
varying vec2 texCoord;
void main(void)
{
    float v = vertOutTexCoord;
    v = float(int(v * 6.0)) / 6.0;
    // vec4 color = texture2D (uTexture, texCoord); // try this to use the diffuse color.
    vec4 color = vec4(0.5, 0.47, 0.43, 1.0);
    gl_FragColor = color * vec4(v, v, v, 1.0);
}
