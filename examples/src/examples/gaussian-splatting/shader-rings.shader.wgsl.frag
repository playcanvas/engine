uniform uRingWidth: f32;
uniform uRingAlpha: f32;
uniform uTime: f32;
uniform uScreenSize: vec4f;

fn modifySplatColor(gaussianUV: vec2f, color: ptr<function, vec4f>) {
    // distance from the splat center: 0 at center, 1 at the clipping edge
    let radius = length(gaussianUV);

    // sharp ring of constant screen-space width at the splat edge: nothing inside, fixed
    // transparency on the ring, replacing the gaussian falloff so the ring is clearly visible.
    // fwidth gives the change of radius per screen pixel, converting pixels to radius units.
    let radiusPerPixel = fwidth(radius);
    let innerEdge = 1.0 - uniform.uRingWidth * radiusPerPixel;
    let ring = smoothstep(innerEdge - radiusPerPixel, innerEdge, radius);
    let alpha = ring * uniform.uRingAlpha;

    // time based highlight pulse, with a screen position based phase so the rings
    // light up in a wave instead of all at the same time
    let phase = (pcPosition.x + pcPosition.y) * uniform.uScreenSize.z * 6.0;
    let highlight = pow(0.5 + 0.5 * sin(uniform.uTime * 2.0 - phase), 4.0);
    *color = vec4f((*color).rgb * (1.0 + highlight * 1.5), alpha);
}
