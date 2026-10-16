// The sky of the dynamic sky effect: the daytime atmosphere, and the night sky.
//
// The daytime atmosphere is a port of the three.js `Sky` shader (MIT licensed), which implements
// the Preetham et al. analytic daylight model:
//   - Model:  A. J. Preetham, P. Shirley, B. Smits, "A Practical Analytic Model for Daylight" (1999)
//   - Shader: three.js `Sky` - Simon Wallner (original atmospheric scattering),
//             Martin Upitis (improved Rayleigh/Mie), Joshua Koo / zz85 (three.js port).
//             https://threejs.org (MIT)
//
// Directions are in the sky space, the world space with X flipped, matching how the engine
// samples cubemaps and the environment atlas, so the visible sky and its baked lighting line up.
export default /* glsl */`
    uniform vec3 dynSkySunDir;          // direction toward the sun
    uniform vec3 dynSkyBetaR;           // rayleigh scattering coefficient
    uniform vec3 dynSkyBetaM;           // mie scattering coefficient
    uniform float dynSkySunE;           // sun intensity
    uniform float dynSkyMieG;           // mie directional anisotropy
    uniform float dynSkyLuminance;      // scale of the sky radiance

    uniform float dynSkyNightBlend;     // 0 by day, 1 at night
    uniform vec3 dynSkyNightColor;      // the color of the night sky, scaled by its brightness
    uniform vec4 dynSkyNightParams;     // x: star brightness, y: star density, z: star size, w: twilight glow
    uniform vec3 dynSkyMoonDir;         // direction toward the moon
    uniform vec4 dynSkyMoonParams;      // xyz: color of the moon disc, scaled by its glow, w: cos of its radius

    const float DYNSKY_PI = 3.141592653589793;
    const vec3 DYNSKY_UP = vec3(0.0, 1.0, 0.0);
    const float DYNSKY_RAYLEIGH_ZENITH = 8.4e3;
    const float DYNSKY_MIE_ZENITH = 1.25e3;
    const float DYNSKY_SUN_ANGULAR_COS = 0.999956676;   // cos of the radius of the sun disc

    float dynSkyRayleighPhase(float cosT) {
        return (3.0 / (16.0 * DYNSKY_PI)) * (1.0 + cosT * cosT);
    }

    float dynSkyHgPhase(float cosT, float g) {
        float g2 = g * g;
        float inv = 1.0 / pow(max(1.0 - 2.0 * g * cosT + g2, 0.0), 1.5);
        return (1.0 / (4.0 * DYNSKY_PI)) * ((1.0 - g2) * inv);
    }

    // the radiance of the last dynamicSkyDay call, lighting the clouds
    vec3 dynSkyScatter;

    // the sun disc of the last dynamicSkyDay call, a light of the sky composited apart from it
    vec3 dynSkySunDisc = vec3(0.0);

    // the daytime sky radiance in a direction, without the sun disc - see dynSkySunDisc
    vec3 dynamicSkyDay(vec3 dirIn) {
        vec3 dir = normalize(dirIn);
        vec3 sunDir = normalize(dynSkySunDir);

        // the scattering coefficients and the sun intensity are the same for the whole sky, so
        // they are computed on the CPU
        vec3 betaR = dynSkyBetaR;
        vec3 betaM = dynSkyBetaM;
        float sunE = dynSkySunE;

        // optical length along the view direction
        float zenithAngle = acos(max(0.0, dot(DYNSKY_UP, dir)));
        float denom = cos(zenithAngle) + 0.15 * pow(max(93.885 - degrees(zenithAngle), 0.0), -1.253);
        float sR = DYNSKY_RAYLEIGH_ZENITH / denom;
        float sM = DYNSKY_MIE_ZENITH / denom;

        vec3 Fex = exp(-(betaR * sR + betaM * sM));

        // in-scattering
        float cosTheta = dot(dir, sunDir);
        vec3 betaRTheta = betaR * dynSkyRayleighPhase(cosTheta * 0.5 + 0.5);
        vec3 betaMTheta = betaM * dynSkyHgPhase(cosTheta, dynSkyMieG);
        vec3 betaSum = betaR + betaM;

        vec3 Lin = pow(sunE * ((betaRTheta + betaMTheta) / betaSum) * (1.0 - Fex), vec3(1.5));
        Lin *= mix(
            vec3(1.0),
            pow(sunE * ((betaRTheta + betaMTheta) / betaSum) * Fex, vec3(0.5)),
            clamp(pow(1.0 - dot(DYNSKY_UP, sunDir), 5.0), 0.0, 1.0)
        );

        // sky base and the sun disc. The disc is returned apart from the sky, so the clouds can
        // block it fully, and the lighting can leave it out: the sun light carries it, and a disc
        // smaller than a texel of the lighting would flicker in and out as the sun moves
        vec3 L0 = vec3(0.1) * Fex;
        float sundisk = smoothstep(DYNSKY_SUN_ANGULAR_COS, DYNSKY_SUN_ANGULAR_COS + 0.00002, cosTheta);
        vec3 disc = sunE * 19000.0 * Fex * sundisk;

        dynSkyScatter = ((Lin + L0) * 0.04 + vec3(0.0, 0.0003, 0.00075)) * dynSkyLuminance;
        dynSkySunDisc = disc * (0.04 * dynSkyLuminance);
        return dynSkyScatter;
    }

    // the night sky without its lights: a deep gradient, and a warm twilight glow centered on the
    // horizon point below the sun, fading out as the sun sinks well below the horizon
    vec3 dynamicSkyNightBase(vec3 dir) {
        vec3 col = dynSkyNightColor * mix(1.1, 0.4, max(dir.y, 0.0));

        vec3 sunH = normalize(vec3(dynSkySunDir.x, 0.0, dynSkySunDir.z) + vec3(1e-5, 0.0, 0.0));
        float toSun = max(dot(dir, sunH), 0.0);
        float belowFade = clamp(1.0 + dynSkySunDir.y * 4.0, 0.0, 1.0);
        col += vec3(1.0, 0.45, 0.15) * (pow(toSun, 5.0) * belowFade * dynSkyNightParams.w);
        return col;
    }

    float dynSkyHash13(vec3 p3) {
        p3 = fract(p3 * 0.1031);
        p3 += dot(p3, p3.yzx + 33.33);
        return fract((p3.x + p3.y) * p3.z);
    }

    // the lights of the night sky: the stars, and the moon disc. The stars are one candidate per
    // cell of a grid sampled along the view direction, each of a random size and brightness. Their
    // edges, and the edge of the moon, are anti-aliased against the pixel footprint, so they stay
    // stable as the camera rotates
    vec3 dynamicSkyNightLights(vec3 dir) {
        vec3 p = dir * 70.0;
        vec3 cell = floor(p);
        float present = step(1.0 - dynSkyNightParams.y, dynSkyHash13(cell));
        vec3 sp = vec3(0.3) + 0.4 * vec3(dynSkyHash13(cell + 11.0), dynSkyHash13(cell + 23.0), dynSkyHash13(cell + 37.0));
        float sizeRnd = dynSkyHash13(cell + 53.0);
        float radius = mix(0.05, 0.22, sizeRnd * sizeRnd) * dynSkyNightParams.z;
        float d = length(fract(p) - sp);
        float aa = length(fwidth(p)) + 1e-4;
        float star = present * mix(0.3, 1.0, dynSkyHash13(cell + 71.0)) * (1.0 - smoothstep(radius - aa, radius + aa, d));
        vec3 col = vec3(star * dynSkyNightParams.x * smoothstep(0.0, 0.04, dir.y));

        float c = dot(dir, normalize(dynSkyMoonDir));
        float aaMoon = max(fwidth(c), 1e-5);
        float disk = smoothstep(dynSkyMoonParams.w - aaMoon, dynSkyMoonParams.w + aaMoon, c);
        col += dynSkyMoonParams.xyz * disk;
        return col;
    }

    // the sky radiance in a direction without its lights, blending the day and the night, and the
    // ambient light around it. The branch is the same for all the pixels, so only one model is
    // evaluated, except during the twilight
    vec3 dynamicSkyBase(vec3 dir, out vec3 ambient) {
        float nb = dynSkyNightBlend;
        vec3 nightAmbient = dynSkyNightColor * 0.6;
        vec3 linear;
        if (nb <= 0.0) {
            linear = dynamicSkyDay(dir);
            ambient = dynSkyScatter;
        } else if (nb >= 1.0) {
            linear = dynamicSkyNightBase(dir);
            ambient = nightAmbient;
        } else {
            linear = mix(dynamicSkyDay(dir), dynamicSkyNightBase(dir), nb);
            ambient = mix(dynSkyScatter, nightAmbient, nb);
        }
        return linear;
    }

    // the ambient light of the sky in a direction, lighting the clouds
    vec3 dynamicSkyAmbient(vec3 dir) {
        vec3 ambient;
        dynamicSkyBase(dir, ambient);
        return ambient;
    }
`;
