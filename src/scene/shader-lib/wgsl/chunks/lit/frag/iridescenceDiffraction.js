export default /* wgsl */`
uniform material_iridescenceRefractionIndex: f32;

fn iridescence_iorToFresnelScalar(transmittedIor: f32, incidentIor: f32) -> f32 {
    return pow((transmittedIor - incidentIor) / (transmittedIor + incidentIor), 2.0);
}

fn iridescence_iorToFresnelVec3(transmittedIor: vec3f, incidentIor: f32) -> vec3f {
    return pow((transmittedIor - vec3f(incidentIor)) / (transmittedIor + vec3f(incidentIor)), vec3f(2.0));
}

fn iridescence_fresnelToIor(f0: vec3f) -> vec3f {
    let sqrtF0: vec3f = sqrt(f0);
    return (vec3f(1.0) + sqrtF0) / (vec3f(1.0) - sqrtF0);
}

const XYZ_TO_REC709: mat3x3f = mat3x3f(
    vec3f(3.2404542, -1.5371385, -0.4985314),
    vec3f(-0.9692660,  1.8760108,  0.0415560),
    vec3f(0.0556434, -0.2040259,  1.0572252)
);

fn iridescence_sensitivity(opd: f32, shift: vec3f) -> vec3f {
    let PI: f32 = 3.141592653589793;
    let phase: f32 = 2.0 * PI * opd * 1.0e-9;
    const val: vec3f = vec3f(5.4856e-13, 4.4201e-13, 5.2481e-13);
    const pos: vec3f = vec3f(1.6810e+06, 1.7953e+06, 2.2084e+06);
    const var_: vec3f = vec3f(4.3278e+09, 9.3046e+09, 6.6121e+09);

    var xyz: vec3f = val * sqrt(2.0 * PI * var_) * cos(pos * phase + shift) * exp(-pow(phase, 2.0) * var_);
    xyz.x = xyz.x + 9.7470e-14 * sqrt(2.0 * PI * 4.5282e+09) * cos(2.2399e+06 * phase + shift[0]) * exp(-4.5282e+09 * pow(phase, 2.0));
    xyz = xyz / vec3f(1.0685e-07);

    return XYZ_TO_REC709 * xyz;
}

fn iridescence_fresnelScalar(cosTheta: f32, f0: f32) -> f32 {
    let x: f32 = clamp(1.0 - cosTheta, 0.0, 1.0);
    let x2: f32 = x * x;
    let x5: f32 = x * x2 * x2;
    return f0 + (1.0 - f0) * x5;
}

fn iridescence_fresnelVec3(cosTheta: f32, f0: vec3f) -> vec3f {
    let x: f32 = clamp(1.0 - cosTheta, 0.0, 1.0);
    let x2: f32 = x * x;
    let x5: f32 = x * x2 * x2;
    return f0 + (vec3f(1.0) - f0) * x5;
}

fn calcIridescence(outsideIor: f32, cosTheta: f32, base_f0: vec3f, iridescenceThickness: f32) -> vec3f {
    let PI: f32 = 3.141592653589793;

    let iridescenceIor: f32 = mix(outsideIor, uniform.material_iridescenceRefractionIndex, smoothstep(0.0, 0.03, iridescenceThickness));
    let sinTheta2Sq: f32 = pow(outsideIor / iridescenceIor, 2.0) * (1.0 - pow(cosTheta, 2.0));
    let cosTheta2Sq: f32 = 1.0 - sinTheta2Sq;

    if (cosTheta2Sq < 0.0) {
        return vec3f(1.0);
    }

    let cosTheta2: f32 = sqrt(cosTheta2Sq);

    let r0: f32 = iridescence_iorToFresnelScalar(iridescenceIor, outsideIor);
    let r12: f32 = iridescence_fresnelScalar(cosTheta, r0);
    let r21: f32 = r12;
    let t121: f32 = 1.0 - r12;

    let phi12: f32 = select(0.0, PI, iridescenceIor < outsideIor);
    let phi21: f32 = PI - phi12;

    let baseIor: vec3f = iridescence_fresnelToIor(base_f0 + vec3f(0.0001));
    let r1: vec3f = iridescence_iorToFresnelVec3(baseIor, iridescenceIor);
    let r23: vec3f = iridescence_fresnelVec3(cosTheta2, r1);

    let phi23: vec3f = select(vec3f(0.0), vec3f(PI), baseIor < vec3f(iridescenceIor));
    let opd: f32 = 2.0 * iridescenceIor * iridescenceThickness * cosTheta2;
    let phi: vec3f = vec3f(phi21) + phi23; // Promote scalar phi21 to vec3f

    let r123Sq: vec3f = clamp(vec3f(r12) * r23, vec3f(1e-5), vec3f(0.9999));
    let r123: vec3f = sqrt(r123Sq);
    let rs: vec3f = pow(vec3f(t121), vec3f(2.0)) * r23 / (vec3f(1.0) - r123Sq);

    let c0: vec3f = vec3f(r12) + rs;
    var i_irid: vec3f = c0;

    var cm: vec3f = rs - vec3f(t121);

    cm = cm * r123;
    let sm1: vec3f = 2.0 * iridescence_sensitivity(1.0 * opd, 1.0 * phi);
    i_irid = i_irid + cm * sm1;

    cm = cm * r123;
    let sm2: vec3f = 2.0 * iridescence_sensitivity(2.0 * opd, 2.0 * phi);
    i_irid = i_irid + cm * sm2;

    return max(i_irid, vec3f(0.0));
}

fn getIridescenceDiffraction(cosTheta: f32, specularity: vec3f, iridescenceThickness: f32) -> vec3f {
    return calcIridescence(1.0, cosTheta, specularity, iridescenceThickness);
}
`;
