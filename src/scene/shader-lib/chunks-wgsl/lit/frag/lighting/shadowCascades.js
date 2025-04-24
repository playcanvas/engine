export default /* wgsl */`

// function which selects a shadow projection matrix index based on cascade distances
fn getShadowCascadeIndex(shadowCascadeDistances: vec4f, shadowCascadeCount: i32) -> i32 {

    // depth in 0 .. far plane range
    let depth: f32 = 1.0 / pcPosition.w;

    // 1.0 if depth >= distance, 0.0 otherwise
    let comparisons: vec4f = step(shadowCascadeDistances, vec4f(depth));

    // sum is the index
    let cascadeIndex: i32 = i32(dot(comparisons, vec4f(1.0)));

    // limit to actual number of used cascades
    return min(cascadeIndex, shadowCascadeCount - 1);
}

// function which modifies cascade index to dither between cascades
fn ditherShadowCascadeIndex(cascadeIndex_in: i32, shadowCascadeDistances: vec4f, shadowCascadeCount: i32, blendFactor: f32) -> i32 {

    // Use var as cascadeIndex might be modified
    var cascadeIndex: i32 = cascadeIndex_in;
    if (cascadeIndex < shadowCascadeCount - 1) {
        let currentRangeEnd: f32 = shadowCascadeDistances[cascadeIndex];
        let transitionStart: f32 = blendFactor * currentRangeEnd; // Start overlap factor away from the end distance
        let depth: f32 = 1.0 / pcPosition.w;

        if (depth > transitionStart) {
            // Calculate a transition factor (0.0 to 1.0) within the overlap range
            let transitionFactor: f32 = smoothstep(transitionStart, currentRangeEnd, depth);

            // Add pseudo-random dithering
            // TODO: replace by user selectable dithering method
            let dither: f32 = fract(sin(dot(pcPosition.xy, vec2f(12.9898, 78.233))) * 43758.5453);
            if (dither < transitionFactor) {
                cascadeIndex = cascadeIndex + 1;
            }
        }
    }

    return cascadeIndex;
}

fn fadeShadow(shadowCoord_in: vec3f, shadowCascadeDistances: vec4f) -> vec3f {
    // if the pixel is past the shadow distance, remove shadow
    // this enforces straight line instead of corner of shadow which moves when camera rotates
    var shadowCoord: vec3f = shadowCoord_in;
    let depth: f32 = 1.0 / pcPosition.w;
    if (depth > shadowCascadeDistances.w) {
        shadowCoord.z = -9999999.0;
    }

    return shadowCoord;
}
`;
