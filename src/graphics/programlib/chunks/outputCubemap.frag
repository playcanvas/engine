varying vec2 vUv0;

uniform samplerCube source;
uniform vec4 params;

void main(void) {

    vec2 st = vUv0 * 2.0 - 1.0;
    float face = params.x;

    vec3 vec;
    if (face==0.0) {
        vec = vec3(1, -st.y, -st.x);
    } else if (face==1.0) {
        vec = vec3(-1, -st.y, st.x);
    } else if (face==2.0) {
        vec = vec3(st.x, 1, st.y);
    } else if (face==3.0) {
        vec = vec3(st.x, -1, -st.y);
    } else if (face==4.0) {
        vec = vec3(st.x, -st.y, 1);
    } else {
        vec = vec3(-st.x, -st.y, -1);
    }

    gl_FragColor = textureCube(source, vec);
}

