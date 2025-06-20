export default /* glsl */`

// function which selects a shadow projection matrix index based on cascade distances 
int getShadowCascadeIndex(vec4 shadowCascadeDistances, int shadowCascadeCount) {

    // depth in 0 .. far plane range
    float depth = 1.0 / gl_FragCoord.w;

    // 1.0 if depth >= distance, 0.0 otherwise
    vec4 comparisons = step(shadowCascadeDistances, vec4(depth));

    // sum is the index
    int cascadeIndex = int(dot(comparisons, vec4(1.0)));

    // limit to actual number of used cascades
    return min(cascadeIndex, shadowCascadeCount - 1);
}

// function which modifies cascade index to dither between cascades
int ditherShadowCascadeIndex(int cascadeIndex, vec4 shadowCascadeDistances, int shadowCascadeCount, float blendFactor) {
 
    if (cascadeIndex < shadowCascadeCount - 1) {
        float currentRangeEnd = shadowCascadeDistances[cascadeIndex];
        float transitionStart = blendFactor * currentRangeEnd; // Start overlap factor away from the end distance
        float depth = 1.0 / gl_FragCoord.w;

        if (depth > transitionStart) {
            // Calculate a transition factor (0.0 to 1.0) within the overlap range
            float transitionFactor = smoothstep(transitionStart, currentRangeEnd, depth);

            // Add pseudo-random dithering
            // TODO: replace by user selectable dithering method
            float dither = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
            if (dither < transitionFactor) {
                cascadeIndex += 1;
            }
        }
    }

    return cascadeIndex;
}

vec3 fadeShadow(vec3 shadowCoord, vec4 shadowCascadeDistances) {                  
    // if the pixel is past the shadow distance, remove shadow
    // this enforces straight line instead of corner of shadow which moves when camera rotates  
    float depth = 1.0 / gl_FragCoord.w;
    if (depth > shadowCascadeDistances.w) {
        shadowCoord.z = -9999999.0;
    }

    return shadowCoord;
}
`;
