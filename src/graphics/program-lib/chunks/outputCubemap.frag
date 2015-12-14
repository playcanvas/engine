varying vec2 vUv0;

uniform samplerCube source;
uniform vec4 params;

float saturate(float x) {
    return clamp(x, 0.0, 1.0);
}

vec4 encodeRGBM(vec4 color) { // modified RGBM
    color.rgb = pow(color.rgb, vec3(0.5));
    color.rgb *= 1.0 / 8.0;

    color.a = saturate( max( max( color.r, color.g ), max( color.b, 1.0 / 255.0 ) ) );
    color.a = ceil(color.a * 255.0) / 255.0;

    color.rgb /= color.a;
    return color;
}

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
    if (params.w >= 2.0) gl_FragColor = encodeRGBM(gl_FragColor);
}

