varying vec2 vUv0;

uniform samplerCube source;
uniform vec4 params; // x = mip

void main(void) {

    vec2 uv = vUv0;

    float side = uv.x < 0.5? 1.0 : -1.0;
    vec2 tc;
    tc.x = fract(uv.x * 2.0) * 2.0 - 1.0;
    tc.y = uv.y * 2.0 - 1.0;

    // scale projection a bit to have a little overlap for filtering
    const float scale = 1.1;
    tc *= scale;

    vec3 dir;
    dir.y = (dot(tc, tc) - 1.0) * side; // from 1.0 center to 0.0 borders quadratically
    dir.xz = tc * -2.0;

    dir.x *= -side * params.y; // flip original cubemap x instead of doing it at runtime

    dir = fixSeams(dir, params.x);

    vec4 color = textureCube(source, dir, -100.0);
    gl_FragColor = color;
}
