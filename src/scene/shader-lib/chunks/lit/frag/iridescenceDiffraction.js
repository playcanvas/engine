export default /* glsl */`
uniform float material_iridescenceRefractionIndex;

#ifndef PI
#define PI 3.14159265
#endif

float iridescence_iorToFresnel(float transmittedIor, float incidentIor) {
    return pow((transmittedIor - incidentIor) / (transmittedIor + incidentIor), 2.0);
}

vec3 iridescence_iorToFresnel(vec3 transmittedIor, float incidentIor) {
    return pow((transmittedIor - vec3(incidentIor)) / (transmittedIor + vec3(incidentIor)), vec3(2.0));
}

vec3 iridescence_fresnelToIor(vec3 f0) {
    vec3 sqrtF0 = sqrt(f0);
    return (vec3(1.0) + sqrtF0) / (vec3(1.0) - sqrtF0);
}

vec3 iridescence_sensitivity(float opd, vec3 shift) {
    float phase = 2.0 * PI * opd * 1.0e-9;
    const vec3 val = vec3(5.4856e-13, 4.4201e-13, 5.2481e-13);
    const vec3 pos = vec3(1.6810e+06, 1.7953e+06, 2.2084e+06);
    const vec3 var = vec3(4.3278e+09, 9.3046e+09, 6.6121e+09);

    vec3 xyz = val * sqrt(2.0 * PI * var) * cos(pos * phase + shift) * exp(-pow(phase, 2.0) * var);
    xyz.x += 9.7470e-14 * sqrt(2.0 * PI * 4.5282e+09) * cos(2.2399e+06 * phase + shift[0]) * exp(-4.5282e+09 * pow(phase, 2.0));
    xyz /= vec3(1.0685e-07);

    const mat3 XYZ_TO_REC709 = mat3(
        3.2404542, -0.9692660,  0.0556434,
       -1.5371385,  1.8760108, -0.2040259,
       -0.4985314,  0.0415560,  1.0572252
    );

    return XYZ_TO_REC709 * xyz;
}

float iridescence_fresnel(float cosTheta, float f0) {
    float x = clamp(1.0 - cosTheta, 0.0, 1.0);
    float x2 = x * x;
    float x5 = x * x2 * x2;
    return f0 + (1.0 - f0) * x5;
} 

vec3 iridescence_fresnel(float cosTheta, vec3 f0) {
    float x = clamp(1.0 - cosTheta, 0.0, 1.0);
    float x2 = x * x;
    float x5 = x * x2 * x2; 
    return f0 + (vec3(1.0) - f0) * x5;
}

vec3 calcIridescence(float outsideIor, float cosTheta, vec3 base_f0, float iridescenceThickness) {

    float iridescenceIor = mix(outsideIor, material_iridescenceRefractionIndex, smoothstep(0.0, 0.03, iridescenceThickness));
    float sinTheta2Sq = pow(outsideIor / iridescenceIor, 2.0) * (1.0 - pow(cosTheta, 2.0));
    float cosTheta2Sq = 1.0 - sinTheta2Sq;

    if (cosTheta2Sq < 0.0) {
        return vec3(1.0);
    }

    float cosTheta2 = sqrt(cosTheta2Sq);

    float r0 = iridescence_iorToFresnel(iridescenceIor, outsideIor);
    float r12 = iridescence_fresnel(cosTheta, r0);
    float r21 = r12;
    float t121 = 1.0 - r12;

    float phi12 = iridescenceIor < outsideIor ? PI : 0.0;
    float phi21 = PI - phi12;

    vec3 baseIor = iridescence_fresnelToIor(base_f0 + vec3(0.0001));
    vec3 r1 = iridescence_iorToFresnel(baseIor, iridescenceIor);
    vec3 r23 = iridescence_fresnel(cosTheta2, r1);

    vec3 phi23 = vec3(0.0);
    if (baseIor[0] < iridescenceIor) phi23[0] = PI;
    if (baseIor[1] < iridescenceIor) phi23[1] = PI;
    if (baseIor[2] < iridescenceIor) phi23[2] = PI;
    float opd = 2.0 * iridescenceIor * iridescenceThickness * cosTheta2;
    vec3 phi = vec3(phi21) + phi23; 

    vec3 r123Sq = clamp(r12 * r23, 1e-5, 0.9999);
    vec3 r123 = sqrt(r123Sq);
    vec3 rs = pow(t121, 2.0) * r23 / (1.0 - r123Sq);

    vec3 c0 = r12 + rs;
    vec3 i = c0;

    vec3 cm = rs - t121;
    for (int m = 1; m <= 2; m++) {
        cm *= r123;
        vec3 sm = 2.0 * iridescence_sensitivity(float(m) * opd, float(m) * phi);
        i += cm * sm;
    }
    return max(i, vec3(0.0));
}

vec3 getIridescence(float cosTheta, vec3 specularity, float iridescenceThickness) {
    return calcIridescence(1.0, cosTheta, specularity, iridescenceThickness);
}
`;
