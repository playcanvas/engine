varying vec2 vUv0;

uniform samplerCube source;

void main(void) {
    float side = vUv0.x < 0.5? 1.0 : -1.0;
    vec2 tc;
    tc.x = fract(vUv0.x * 2.0) * 2.0 - 1.0;
    tc.y = vUv0.y * 2.0 - 1.0;

    vec3 dir;
    dir.y = (dot(tc, tc) - 1.0) * side;
    dir.xz = tc * -2.0;

    vec4 color = textureCube(source, dir);
    gl_FragColor = color;
}
