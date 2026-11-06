uniform vec3 uClipCenter;
uniform vec3 uClipHalf;

void modifySplatCenter(inout vec3 center) {
}

void modifySplatRotationScale(vec3 originalCenter, vec3 modifiedCenter, inout vec4 rotation, inout vec3 scale) {
    // signed distance of the splat center from the clipping box surface (negative inside)
    vec3 d = abs(modifiedCenter - uClipCenter) - uClipHalf;
    float sdf = length(max(d, vec3(0.0))) + min(max(d.x, max(d.y, d.z)), 0.0);

    // conservative splat radius
    float radius = 2.0 * gsplatGetSizeFromScale(scale);

    if (sdf < -radius) {
        // fully inside the box - clip the whole splat
        scale = vec3(0.0);
        setClipState(1u);
    } else if (sdf > radius) {
        // fully outside the box - no per-pixel clipping needed
        setClipState(1u);
    } else {
        // intersects the box surface - clip per pixel in the fragment shader
        setClipState(0u);
    }
}

void modifySplatColor(vec3 center, inout vec4 color) {
}
