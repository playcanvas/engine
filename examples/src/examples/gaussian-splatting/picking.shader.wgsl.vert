uniform fade: f32;

// animate position based on the fade value
fn modifyPosition(pos: vec3f) -> vec3f {
    // Use a sine wave to create a smooth scale down and back up animation
    let angle = uniform.fade * 3.14159265;
    let shrinkFactor = sin(angle) * 0.3;
    let scale = 1.0 - shrinkFactor;
    return pos * scale;
}

// animate color based on the fade value
fn modifyColor(center: vec3f, clr: vec4f) -> vec4f {
    var result = clr;

    // Check if the color is approximately grayscale
    let r = clr.r;
    let g = clr.g;
    let b = clr.b;

    let grayscaleThreshold = 0.01;
    let isGrayscale = abs(r - g) < grayscaleThreshold &&
                      abs(r - b) < grayscaleThreshold &&
                      abs(g - b) < grayscaleThreshold;

    if (isGrayscale) {
        // If the color is grayscale, make it very bright (the PC logo)
        result = vec4f(clr.rgb * 10.0, clr.a);
    } else {
        // cross fade blue to original orange color based on fade value
        result = vec4f(mix(clr.bgr * 0.5, clr.rgb, uniform.fade), clr.a);
    }

    return result;
}

