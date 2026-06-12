uniform vec3 uClipCenter;
uniform vec3 uClipHalf;
uniform mat4 uInvViewProj;
uniform vec4 uScreenSize;

void modifySplatColor(vec2 gaussianUV, inout vec4 color) {
    // splats fully inside or outside the box were already resolved per splat in the vertex stage
    if (getClipState() == 1u) return;

    // reconstruct the world position of this fragment (on the splat's depth plane)
    vec3 ndc = vec3(gl_FragCoord.xy * uScreenSize.zw, gl_FragCoord.z) * 2.0 - 1.0;
    vec4 world = uInvViewProj * vec4(ndc, 1.0);
    vec3 worldPos = world.xyz / world.w;

    // clip fragments inside the box
    vec3 d = abs(worldPos - uClipCenter) - uClipHalf;
    if (max(d.x, max(d.y, d.z)) < 0.0) {
        color.a = 0.0;
    }
}
