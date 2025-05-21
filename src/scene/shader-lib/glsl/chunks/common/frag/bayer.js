// procedural Bayer matrix, based on: https://www.shadertoy.com/view/Mlt3z8

export default /* glsl */`
// 2x2 bayer matrix [1 2][3 0], p in [0,1]
float bayer2(vec2 p) {
    return mod(2.0 * p.y + p.x + 1.0, 4.0);
}

// 4x4 matrix, p - pixel coordinate
float bayer4(vec2 p) {
    vec2 p1 = mod(p, 2.0);
    vec2 p2 = floor(0.5 * mod(p, 4.0));
    return 4.0 * bayer2(p1) + bayer2(p2);
}

// 8x8 matrix, p - pixel coordinate
float bayer8(vec2 p) {
    vec2 p1 = mod(p, 2.0);
    vec2 p2 = floor(0.5 * mod(p, 4.0));
    vec2 p4 = floor(0.25 * mod(p, 8.0));
    return 4.0 * (4.0 * bayer2(p1) + bayer2(p2)) + bayer2(p4);
}
`;
