#extension GL_EXT_shader_texture_lod : enable

varying vec2 vUv0;

uniform samplerCube source;
uniform vec4 params; // x = mip

void main(void) {

    vec2 uv = vUv0;//floor(gl_FragCoord.xy) * params.yz;

    float side = uv.x < 0.5? 1.0 : -1.0;
    vec2 tc;
    tc.x = fract(uv.x * 2.0) * 2.0 - 1.0;
    tc.y = uv.y * 2.0 - 1.0;

    float scale = 1.1;
    tc *= scale;

    //tc.x += tc.x<0.0? -params.z * 0.5 : params.z * 0.5;
    //tc.y += tc.y<0.0? -params.z * 0.5 : params.z * 0.5;
    //tc += params.zz;

    vec3 dir;
    dir.y = (dot(tc, tc) - 1.0) * side; // from 1.0 center to 0.0 borders quadratically
    dir.xz = tc * -2.0;

    dir.x *= side;

    dir = fixSeams(dir, params.x);
    dir.x *= -1.0;

        /*dir = normalize(dir);
        float ext = 1.0 / 16.0;
        dir.y = length(tc);
        dir.y = dir.y * (ext + 1.0) - ext;
        dir.y = (sqrt(dir.y) - 1.0) * side;*/

    vec4 color = textureCubeLodEXT(source, dir, 0.0);//params.x);
    //vec4 color = textureCube(source, dir);//params.x);
    gl_FragColor = color;
}
