#extension GL_EXT_shader_texture_lod : enable

varying vec2 vUv0;

uniform samplerCube source;
uniform vec4 params; // x = mip

void main(void) {
    float side = vUv0.x < 0.5? 1.0 : -1.0;
    vec2 tc;
    tc.x = fract(vUv0.x * 2.0) * 2.0 - 1.0;
    tc.y = vUv0.y * 2.0 - 1.0;

    vec3 dir;
    dir.y = (dot(tc, tc) - 1.0) * side; // from 1.0 center to 0.0 borders quadratically
    dir.xz = tc * -2.0;

    dir.x *= side;

    dir = fixSeams(dir);
    vec4 color = textureCubeLodEXT(source, dir, params.x);
    gl_FragColor = color;
}
