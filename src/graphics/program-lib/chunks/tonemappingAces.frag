uniform MEDP float exposure;

vec3 toneMap(vec3 color) {
    MEDP float tA = 2.51;
    MEDP float tB = 0.03;
    MEDP float tC = 2.43;
    MEDP float tD = 0.59;
    MEDP float tE = 0.14;
    MEDP vec3 x = color * exposure;
    return (x*(tA*x+tB))/(x*(tC*x+tD)+tE);
}
