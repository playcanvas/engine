varying vec2 vUv0;

uniform samplerCube source;
uniform vec4 params;

float saturate(float x) {
    return clamp(x, 0.0, 1.0);
}

float rnd(vec2 uv) {
    return fract(sin(dot(uv, vec2(12.9898, 78.233) * 2.0)) * 43758.5453);
}

const float PI = 3.14159265358979;
vec3 hemisphereSample_cos(vec2 uv, mat3 vecSpace, vec3 cubeDir, float gloss) { // cos + lerped cone size (better than just lerped)
    float phi = uv.y * 2.0 * PI;
    float cosTheta = sqrt(1.0 - uv.x);
    float sinTheta = sqrt(1.0 - cosTheta * cosTheta);
    vec3 sampleDir = vec3(cos(phi) * sinTheta, sin(phi) * sinTheta, cosTheta);
    return normalize(mix(vecSpace * sampleDir, cubeDir, params.y));
}

vec3 hemisphereSample_phong(vec2 uv, mat3 vecSpace, vec3 cubeDir, float specPow) {
    float phi = uv.y * 2.0 * PI;
    float cosTheta = pow(1.0 - uv.x, 1.0 / (specPow + 1.0));
    float sinTheta = sqrt(1.0 - cosTheta * cosTheta);
    vec3 sampleDir = vec3(cos(phi) * sinTheta, sin(phi) * sinTheta, cosTheta);
    return vecSpace * sampleDir;
}

mat3 matrixFromVector(vec3 n) { // frisvad
    float a = 1.0 / (1.0 + n.z);
    float b = -n.x * n.y * a;
    vec3 b1 = vec3(1.0 - n.x * n.x * a, b, -n.x);
    vec3 b2 = vec3(b, 1.0 - n.y * n.y * a, -n.y);
    return mat3(b1, b2, n);
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

    if (params.w==1.0 || params.w==3.0) {
        st = 2.0 * floor(gl_FragCoord.xy) / (params.z - 1.0) - 1.0;
    }

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

    mat3 vecSpace = matrixFromVector(normalize(vec));

    vec4 color = vec4(0.0);
    const int samples = $NUMSAMPLES;
    vec3 vect;
    for(int i=0; i<samples; i++) {
        float sini = sin(float(i));
        float cosi = cos(float(i));
        float rand = rnd(vec2(sini, cosi));

        vect = hemisphereSample_$METHOD(vec2(float(i) / float(samples), rand), vecSpace, vec, params.y);

        color += textureCube(source, vect);
    }
    color /= float(samples);

    gl_FragColor = params.w < 2.0? color : encodeRGBM(color);
}
