

vec2 recomputeUVWithTextureBorders(vec2 normalizedUv, mat4 bordersMatrix) {
    // ut is a vector that has a component set 1 depending on which band does the current U
    // coordinate fall into. Consider a border matrix having the 3rd row set to 0, 0.25, 0.5, 1.
    // ut will be (1, 0, 0, 0) for U coord being in the range [0, 0.25), (0, 1, 0, 0) for U coord
    // being in the range of [0.25, 0.5) etc.
    vec4 ut = vec4(  
        1.0 - step(bordersMatrix[2][1], normalizedUv.x),
        step(bordersMatrix[2][1], normalizedUv.x) * (1.0 - step(bordersMatrix[2][2], normalizedUv.x)),
        step(bordersMatrix[2][2], normalizedUv.x),
        0.0
    );

    // similar to ut, but for V coordinate
    vec4 vt = vec4( 
        1.0 - step(bordersMatrix[3][1], normalizedUv.y),
        step(bordersMatrix[3][1], normalizedUv.y) * (1.0 - step(bordersMatrix[3][2], normalizedUv.y)),
        step(bordersMatrix[3][2], normalizedUv.y),
        0.0
    );

    // once we got the ut and vt vector, let's compute current coord band start and end values...
    float uStart = ut.x * bordersMatrix[2][0] + ut.y * bordersMatrix[2][1] + ut.z * bordersMatrix[2][2];
    float uEnd   = ut.x * bordersMatrix[2][1] + ut.y * bordersMatrix[2][2] + ut.z * bordersMatrix[2][3];

    float vStart = vt.x * bordersMatrix[3][0] + vt.y * bordersMatrix[3][1] + vt.z * bordersMatrix[3][2];
    float vEnd   = vt.x * bordersMatrix[3][1] + vt.y * bordersMatrix[3][2] + vt.z * bordersMatrix[3][3];

    // and see how much we have advanced in the current U and V bands
    float tx = (normalizedUv.x - uStart) / (uEnd - uStart);
    float ty = (normalizedUv.y - vStart) / (vEnd - vStart);

    // then we simply compute the target U and V bands we want to map onto
    float uDestStart = ut.x * bordersMatrix[0][0] + ut.y * bordersMatrix[0][1] + ut.z * bordersMatrix[0][2];
    float uDestEnd   = ut.x * bordersMatrix[0][1] + ut.y * bordersMatrix[0][2] + ut.z * bordersMatrix[0][3];

    float vDestStart = vt.x * bordersMatrix[1][0] + vt.y * bordersMatrix[1][1] + vt.z * bordersMatrix[1][2];
    float vDestEnd   = vt.x * bordersMatrix[1][1] + vt.y * bordersMatrix[1][2] + vt.z * bordersMatrix[1][3];

    // and lerp current band's advancement to the resulting UV
    float x = mix(uDestStart, uDestEnd, tx);
    float y = mix(vDestStart, vDestEnd, ty);

    return vec2( x, y );
}

