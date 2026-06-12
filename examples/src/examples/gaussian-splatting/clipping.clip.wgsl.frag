uniform uClipCenter: vec3f;
uniform uClipHalf: vec3f;
uniform uInvViewProj: mat4x4f;
uniform uScreenSize: vec4f;

fn modifySplatColor(gaussianUV: vec2f, color: ptr<function, vec4f>) {
    // splats fully inside or outside the box were already resolved per splat in the vertex stage
    if (getClipState() == 1u) {
        return;
    }

    // reconstruct the world position of this fragment (on the splat's depth plane)
    let uv = pcPosition.xy * uniform.uScreenSize.zw;
    let ndc = vec3f(uv.x * 2.0 - 1.0, (1.0 - uv.y) * 2.0 - 1.0, pcPosition.z * 2.0 - 1.0);
    let world = uniform.uInvViewProj * vec4f(ndc, 1.0);
    let worldPos = world.xyz / world.w;

    // clip fragments inside the box
    let d = abs(worldPos - uniform.uClipCenter) - uniform.uClipHalf;
    if (max(d.x, max(d.y, d.z)) < 0.0) {
        *color = vec4f((*color).rgb, 0.0);
    }
}
