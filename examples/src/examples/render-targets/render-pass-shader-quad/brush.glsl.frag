// the color of the brush, and the brightness of a single dot
uniform vec3 uBrushColor;
uniform float uBrushIntensity;

// the position within the viewport the quad covers
varying vec2 uv0;

void main(void)
{
    // the distance from the center of the dot, 1 at the edge of the viewport
    float dist = length(uv0 * 2.0 - 1.0);

    // a soft glow, with a white hot core
    float glow = 1.0 - smoothstep(0.0, 1.0, dist);
    glow *= glow;
    float core = 1.0 - smoothstep(0.0, 0.3, dist);

    // the color is premultiplied by the alpha, as the blend states of the pass expect
    vec3 color = (uBrushColor * glow + vec3(0.7 * core)) * uBrushIntensity;
    gl_FragColor = vec4(color, glow * uBrushIntensity);
}
