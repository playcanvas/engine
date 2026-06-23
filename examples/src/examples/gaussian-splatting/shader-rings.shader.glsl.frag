uniform float uRingWidth;
uniform float uRingAlpha;
uniform float uTime;
uniform vec4 uScreenSize;

void modifySplatColor(vec2 gaussianUV, inout vec4 color) {
    // distance from the splat center: 0 at center, 1 at the clipping edge
    float radius = length(gaussianUV);

    // sharp ring of constant screen-space width at the splat edge: nothing inside, fixed
    // transparency on the ring, replacing the gaussian falloff so the ring is clearly visible.
    // fwidth gives the change of radius per screen pixel, converting pixels to radius units.
    float radiusPerPixel = fwidth(radius);
    float innerEdge = 1.0 - uRingWidth * radiusPerPixel;
    float ring = smoothstep(innerEdge - radiusPerPixel, innerEdge, radius);
    color.a = ring * uRingAlpha;

    // time based highlight pulse, with a screen position based phase so the rings
    // light up in a wave instead of all at the same time
    float phase = (gl_FragCoord.x + gl_FragCoord.y) * uScreenSize.z * 6.0;
    float highlight = pow(0.5 + 0.5 * sin(uTime * 2.0 - phase), 4.0);
    color.rgb *= 1.0 + highlight * 1.5;
}
