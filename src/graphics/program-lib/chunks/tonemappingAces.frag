uniform PMEDP float exposure;

vec3 toneMap(vec3 color) {
    PMEDP float tA = 2.51;
    PMEDP float tB = 0.03;
    PMEDP float tC = 2.43;
    PMEDP float tD = 0.59;
    PMEDP float tE = 0.14;
    PMEDP vec3 x = color * exposure;
    return (x*(tA*x+tB))/(x*(tC*x+tD)+tE);
}
