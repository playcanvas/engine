export default /* glsl */`
vec3 toneMap(vec3 color) {
    float tA = 2.51;
    float tB = 0.03;
    float tC = 2.43;
    float tD = 0.59;
    float tE = 0.14;
    vec3 x = color * getExposure();
    return (x*(tA*x+tB))/(x*(tC*x+tD)+tE);
}
`;
