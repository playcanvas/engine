varying vec2 vUv0;
uniform samplerCube source;

vec4 lookup(samplerCube tex, vec3 dir) {
    return textureCube(tex, fixSeamsStatic(dir, 0.75));
}

vec4 lookup4(samplerCube tex, vec3 dir) {
    bvec3 nonzero = notEqual(dir, vec3(0.0));
    vec3 xdir = nonzero.x? vec3(0,1,0) : vec3(1,0,0);
    vec3 ydir = nonzero.x? vec3(0,0,1) : (nonzero.y? vec3(0,0,1) : vec3(0,1,0));
    vec4 color = vec4(0.0);
    for(int y=0; y<2; y++) {
        for(int x=0; x<2; x++) {
            vec2 offset = vec2(x, y) - vec2(0.5);
            color += lookupLinear(tex, dir + xdir * offset.x + ydir * offset.y);
        }
    }
}

void main(void) {

    vec4 color = vec4(0.0);

    color += lookup4(source, vec3(-1,0,0));
    color += lookup4(source, vec3(1,0,0));
    color += lookup4(source, vec3(0,-1,0));
    color += lookup4(source, vec3(0,1,0));
    color += lookup4(source, vec3(0,0,-1));
    color += lookup4(source, vec3(0,0,1));

    gl_FragColor = color * 0.04166666666666666666666666666667;// 1.0 / 24.0;
}
