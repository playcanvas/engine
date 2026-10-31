uniform uClipCenter: vec3f;
uniform uClipHalf: vec3f;

fn modifySplatCenter(center: ptr<function, vec3f>) {
}

fn modifySplatRotationScale(originalCenter: vec3f, modifiedCenter: vec3f, rotation: ptr<function, vec4f>, scale: ptr<function, vec3f>) {
    // signed distance of the splat center from the clipping box surface (negative inside)
    let d = abs(modifiedCenter - uniform.uClipCenter) - uniform.uClipHalf;
    let sdf = length(max(d, vec3f(0.0))) + min(max(d.x, max(d.y, d.z)), 0.0);

    // conservative splat radius
    let radius = 2.0 * gsplatGetSizeFromScale(*scale);

    if (sdf < -radius) {
        // fully inside the box - clip the whole splat
        *scale = vec3f(0.0);
        setClipState(1u);
    } else if (sdf > radius) {
        // fully outside the box - no per-pixel clipping needed
        setClipState(1u);
    } else {
        // intersects the box surface - clip per pixel in the fragment shader
        setClipState(0u);
    }
}

fn modifySplatColor(center: vec3f, color: ptr<function, vec4f>) {
}
