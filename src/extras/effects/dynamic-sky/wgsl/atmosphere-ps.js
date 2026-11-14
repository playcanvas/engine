// The sky of the dynamic sky effect: the daytime atmosphere, and the night sky. See the GLSL
// version for the details and the credits of the daytime atmosphere, a port of the three.js `Sky`
// shader (MIT licensed) implementing the Preetham et al. analytic daylight model.
export default /* wgsl */`
    uniform dynSkySunDir: vec3f;
    uniform dynSkyBetaR: vec3f;
    uniform dynSkyBetaM: vec3f;
    uniform dynSkySunE: f32;
    uniform dynSkyMieG: f32;
    uniform dynSkyLuminance: f32;

    uniform dynSkyNightBlend: f32;
    uniform dynSkyNightColor: vec3f;
    uniform dynSkyNightParams: vec4f;
    uniform dynSkyMoonDir: vec3f;
    uniform dynSkyMoonParams: vec4f;

    const DYNSKY_PI: f32 = 3.141592653589793;
    const DYNSKY_UP = vec3f(0.0, 1.0, 0.0);
    const DYNSKY_RAYLEIGH_ZENITH: f32 = 8.4e3;
    const DYNSKY_MIE_ZENITH: f32 = 1.25e3;
    const DYNSKY_SUN_ANGULAR_COS: f32 = 0.999956676;

    fn dynSkyRayleighPhase(cosT: f32) -> f32 {
        return (3.0 / (16.0 * DYNSKY_PI)) * (1.0 + cosT * cosT);
    }

    fn dynSkyHgPhase(cosT: f32, g: f32) -> f32 {
        let g2 = g * g;
        let inv = 1.0 / pow(max(1.0 - 2.0 * g * cosT + g2, 0.0), 1.5);
        return (1.0 / (4.0 * DYNSKY_PI)) * ((1.0 - g2) * inv);
    }

    // the radiance of the last dynamicSkyDay call, lighting the clouds
    var<private> dynSkyScatter: vec3f;

    // the sun disc of the last dynamicSkyDay call, a light of the sky composited apart from it
    var<private> dynSkySunDisc: vec3f;

    fn dynamicSkyDay(dirIn: vec3f) -> vec3f {
        let dir = normalize(dirIn);
        let sunDir = normalize(uniform.dynSkySunDir);

        let betaR = uniform.dynSkyBetaR;
        let betaM = uniform.dynSkyBetaM;
        let sunE = uniform.dynSkySunE;

        let zenithAngle = acos(max(0.0, dot(DYNSKY_UP, dir)));
        let denom = cos(zenithAngle) + 0.15 * pow(max(93.885 - degrees(zenithAngle), 0.0), -1.253);
        let sR = DYNSKY_RAYLEIGH_ZENITH / denom;
        let sM = DYNSKY_MIE_ZENITH / denom;

        let Fex = exp(-(betaR * sR + betaM * sM));

        let cosTheta = dot(dir, sunDir);
        let betaRTheta = betaR * dynSkyRayleighPhase(cosTheta * 0.5 + 0.5);
        let betaMTheta = betaM * dynSkyHgPhase(cosTheta, uniform.dynSkyMieG);
        let betaSum = betaR + betaM;

        var Lin = pow(sunE * ((betaRTheta + betaMTheta) / betaSum) * (vec3f(1.0) - Fex), vec3f(1.5));
        Lin = Lin * mix(
            vec3f(1.0),
            pow(sunE * ((betaRTheta + betaMTheta) / betaSum) * Fex, vec3f(0.5)),
            vec3f(clamp(pow(1.0 - dot(DYNSKY_UP, sunDir), 5.0), 0.0, 1.0))
        );

        // the sun disc is returned apart from the sky, see the GLSL version
        let L0 = vec3f(0.1) * Fex;
        let sundisk = smoothstep(DYNSKY_SUN_ANGULAR_COS, DYNSKY_SUN_ANGULAR_COS + 0.00002, cosTheta);
        let disc = sunE * 19000.0 * Fex * sundisk;

        dynSkyScatter = ((Lin + L0) * 0.04 + vec3f(0.0, 0.0003, 0.00075)) * uniform.dynSkyLuminance;
        dynSkySunDisc = disc * (0.04 * uniform.dynSkyLuminance);
        return dynSkyScatter;
    }

    fn dynamicSkyNightBase(dir: vec3f) -> vec3f {
        var col = uniform.dynSkyNightColor * mix(1.1, 0.4, max(dir.y, 0.0));

        let sunH = normalize(vec3f(uniform.dynSkySunDir.x, 0.0, uniform.dynSkySunDir.z) + vec3f(1e-5, 0.0, 0.0));
        let toSun = max(dot(dir, sunH), 0.0);
        let belowFade = clamp(1.0 + uniform.dynSkySunDir.y * 4.0, 0.0, 1.0);
        col = col + vec3f(1.0, 0.45, 0.15) * (pow(toSun, 5.0) * belowFade * uniform.dynSkyNightParams.w);
        return col;
    }

    fn dynSkyHash13(p3in: vec3f) -> f32 {
        var p3 = fract(p3in * 0.1031);
        p3 = p3 + dot(p3, p3.yzx + 33.33);
        return fract((p3.x + p3.y) * p3.z);
    }

    fn dynamicSkyNightLights(dir: vec3f) -> vec3f {
        let p = dir * 70.0;
        let cell = floor(p);
        let present = step(1.0 - uniform.dynSkyNightParams.y, dynSkyHash13(cell));
        let sp = vec3f(0.3) + 0.4 * vec3f(dynSkyHash13(cell + 11.0), dynSkyHash13(cell + 23.0), dynSkyHash13(cell + 37.0));
        let sizeRnd = dynSkyHash13(cell + 53.0);
        let radius = mix(0.05, 0.22, sizeRnd * sizeRnd) * uniform.dynSkyNightParams.z;
        let d = length(fract(p) - sp);
        let aa = length(fwidth(p)) + 1e-4;
        let star = present * mix(0.3, 1.0, dynSkyHash13(cell + 71.0)) * (1.0 - smoothstep(radius - aa, radius + aa, d));
        var col = vec3f(star * uniform.dynSkyNightParams.x * smoothstep(0.0, 0.04, dir.y));

        let c = dot(dir, normalize(uniform.dynSkyMoonDir));
        let aaMoon = max(fwidth(c), 1e-5);
        let disk = smoothstep(uniform.dynSkyMoonParams.w - aaMoon, uniform.dynSkyMoonParams.w + aaMoon, c);
        col = col + uniform.dynSkyMoonParams.xyz * disk;
        return col;
    }

    fn dynamicSkyBase(dir: vec3f, ambient: ptr<function, vec3f>) -> vec3f {
        let nb = uniform.dynSkyNightBlend;
        let nightAmbient = uniform.dynSkyNightColor * 0.6;
        var linear: vec3f;
        if (nb <= 0.0) {
            linear = dynamicSkyDay(dir);
            *ambient = dynSkyScatter;
        } else if (nb >= 1.0) {
            linear = dynamicSkyNightBase(dir);
            *ambient = nightAmbient;
        } else {
            linear = mix(dynamicSkyDay(dir), dynamicSkyNightBase(dir), vec3f(nb));
            *ambient = mix(dynSkyScatter, nightAmbient, vec3f(nb));
        }
        return linear;
    }

    fn dynamicSkyAmbient(dir: vec3f) -> vec3f {
        var ambient: vec3f;
        _ = dynamicSkyBase(dir, &ambient);
        return ambient;
    }
`;
