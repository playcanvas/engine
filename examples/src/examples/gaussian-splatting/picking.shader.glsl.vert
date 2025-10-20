uniform float fade;

// animate position based on the fade value
vec3 modifyPosition(vec3 pos) {
    // Use a sine wave to create a smooth scale down and back up animation
    float angle = fade * 3.14159265;
    float shrinkFactor = sin(angle) * 0.3;
    float scale = 1.0 - shrinkFactor;
    return pos * scale;
}

// animate color based on the fade value
vec4 modifyColor(vec3 center, vec4 clr) {

    // Check if the color is approximately grayscale
    float r = clr.r;
    float g = clr.g;
    float b = clr.b;

    float grayscaleThreshold = 0.01;
    bool isGrayscale = abs(r - g) < grayscaleThreshold &&
                       abs(r - b) < grayscaleThreshold &&
                       abs(g - b) < grayscaleThreshold;

    if (isGrayscale) {
        // If the color is grayscale, make it very bright (the PC logo)
        clr.rgb *= 10.0;
    } else {
        // cross fade blue to original orange color based on fade value
        clr.rgb = mix(clr.bgr * 0.5, clr.rgb, fade);
    }

    return clr;
}

