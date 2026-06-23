// Procedural sky ESM script.
//
// The daytime atmosphere is a port of the three.js `Sky` shader (MIT licensed), which implements
// the Preetham et al. analytic daylight model:
//   - Model:  A. J. Preetham, P. Shirley, B. Smits, "A Practical Analytic Model for Daylight" (1999)
//   - Shader: three.js `Sky` - Simon Wallner (original atmospheric scattering),
//             Martin Upitis (improved Rayleigh/Mie), Joshua Koo / zz85 (three.js port).
//             https://threejs.org (MIT)
//
// The night sky, RGBM image-based-lighting bake, day/night blend and moon are original additions.

import {
    ADDRESS_CLAMP_TO_EDGE,
    Color,
    EnvLighting,
    FILTER_LINEAR,
    Mat4,
    PIXELFORMAT_RGBA8,
    Quat,
    RenderTarget,
    Script,
    SEMANTIC_POSITION,
    SHADERLANGUAGE_GLSL,
    SHADERLANGUAGE_WGSL,
    ShaderChunks,
    ShaderUtils,
    TEXTUREPROJECTION_EQUIRECT,
    TEXTURETYPE_RGBM,
    Texture,
    Vec3,
    drawQuadWithShader
} from 'playcanvas';

// Atmosphere constants from the three.js `Sky` shader, used on the CPU to precompute the
// view-independent scattering terms (see _updateAtmosphere).
const SKY_TOTAL_RAYLEIGH = [5.804542996261093e-6, 1.3562911419845635e-5, 3.0265902468824876e-5];
const SKY_MIE_CONST = [1.8399918514433978e14, 2.7798023919660528e14, 4.0790479543861094e14];
const SKY_EE = 1000.0;
const SKY_CUTOFF = 1.6110731556870734;
const SKY_STEEPNESS = 1.5;

/**
 * Shared core of the daytime sky model - a port of the three.js `Sky` fragment shader (see the
 * credit block at the top of the file). The values three.js precomputes per-frame in its vertex
 * shader are inlined here. Given a world-space `dir`, returns the linear HDR sky radiance.
 *
 * Inputs come from globally-scoped uniforms, prefixed `procSky` so they cannot clash with any
 * other engine/material uniform (there is no public API to set uniforms on the engine's internally
 * created sky material, so we feed these through `device.scope`).
 */
const SKY_CORE_GLSL = /* glsl */ `
    uniform vec3 procSkySunDir;          // normalized direction towards the sun (sky space)
    uniform vec3 procSkyBetaR;           // rayleigh scattering coefficient (CPU-precomputed)
    uniform vec3 procSkyBetaM;           // mie scattering coefficient (CPU-precomputed)
    uniform float procSkySunE;           // sun intensity (CPU-precomputed)
    uniform float procSkyMieG;           // mie directional anisotropy
    uniform float procSkyLuminance;      // output HDR scale

    const float PI_SKY = 3.141592653589793;
    const vec3 SKY_UP = vec3(0.0, 1.0, 0.0);
    const float SKY_RAYLEIGH_ZENITH = 8.4e3;
    const float SKY_MIE_ZENITH = 1.25e3;
    const float SKY_SUN_ANGULAR_COS = 0.999956676; // cos of the sun disc half angle

    float skyRayleighPhase(float cosT) {
        return (3.0 / (16.0 * PI_SKY)) * (1.0 + cosT * cosT);
    }

    float skyHgPhase(float cosT, float g) {
        float g2 = g * g;
        float inv = 1.0 / pow(max(1.0 - 2.0 * g * cosT + g2, 0.0), 1.5);
        return (1.0 / (4.0 * PI_SKY)) * ((1.0 - g2) * inv);
    }

    vec3 proceduralSky(vec3 dirIn) {
        vec3 dir = normalize(dirIn);
        vec3 sunDir = normalize(procSkySunDir);

        // betaR, betaM and sunE are view-independent (constant across the sky), so they are
        // computed once per frame on the CPU and supplied as uniforms (see _updateAtmosphere).
        // three.js computes these per-vertex; on the CPU is cheaper still.
        vec3 betaR = procSkyBetaR;
        vec3 betaM = procSkyBetaM;
        float sunE = procSkySunE;

        // optical length along the view direction
        float zenithAngle = acos(max(0.0, dot(SKY_UP, dir)));
        float denom = cos(zenithAngle) + 0.15 * pow(max(93.885 - degrees(zenithAngle), 0.0), -1.253);
        float sR = SKY_RAYLEIGH_ZENITH / denom;
        float sM = SKY_MIE_ZENITH / denom;

        vec3 Fex = exp(-(betaR * sR + betaM * sM));

        // in-scattering
        float cosTheta = dot(dir, sunDir);
        vec3 betaRTheta = betaR * skyRayleighPhase(cosTheta * 0.5 + 0.5);
        vec3 betaMTheta = betaM * skyHgPhase(cosTheta, procSkyMieG);
        vec3 betaSum = betaR + betaM;

        vec3 Lin = pow(sunE * ((betaRTheta + betaMTheta) / betaSum) * (1.0 - Fex), vec3(1.5));
        Lin *= mix(
            vec3(1.0),
            pow(sunE * ((betaRTheta + betaMTheta) / betaSum) * Fex, vec3(0.5)),
            clamp(pow(1.0 - dot(SKY_UP, sunDir), 5.0), 0.0, 1.0)
        );

        // sky base + sun disc
        vec3 L0 = vec3(0.1) * Fex;
        float sundisk = smoothstep(SKY_SUN_ANGULAR_COS, SKY_SUN_ANGULAR_COS + 0.00002, cosTheta);
        L0 += sunE * 19000.0 * Fex * sundisk;

        vec3 col = (Lin + L0) * 0.04 + vec3(0.0, 0.0003, 0.00075);
        // Clamp the sun disc to a value the bloom can handle. The WebGPU bloom down/upsample
        // shaders sum 4 neighbour taps in f16 (half) before scaling, and accumulate mip levels
        // additively - so a very bright pixel overflows those intermediate f16 sums (max 65504)
        // to Inf/NaN and corrupts the whole screen. 6000 keeps every intermediate well in range.
        return min(col * procSkyLuminance, vec3(6000.0));
    }
`;

const SKY_CORE_WGSL = /* wgsl */ `
    uniform procSkySunDir: vec3f;
    uniform procSkyBetaR: vec3f;
    uniform procSkyBetaM: vec3f;
    uniform procSkySunE: f32;
    uniform procSkyMieG: f32;
    uniform procSkyLuminance: f32;

    const PI_SKY: f32 = 3.141592653589793;
    const SKY_UP = vec3f(0.0, 1.0, 0.0);
    const SKY_RAYLEIGH_ZENITH: f32 = 8.4e3;
    const SKY_MIE_ZENITH: f32 = 1.25e3;
    const SKY_SUN_ANGULAR_COS: f32 = 0.999956676;

    fn skyRayleighPhase(cosT: f32) -> f32 {
        return (3.0 / (16.0 * PI_SKY)) * (1.0 + cosT * cosT);
    }

    fn skyHgPhase(cosT: f32, g: f32) -> f32 {
        let g2 = g * g;
        let inv = 1.0 / pow(max(1.0 - 2.0 * g * cosT + g2, 0.0), 1.5);
        return (1.0 / (4.0 * PI_SKY)) * ((1.0 - g2) * inv);
    }

    fn proceduralSky(dirIn: vec3f) -> vec3f {
        let dir = normalize(dirIn);
        let sunDir = normalize(uniform.procSkySunDir);

        // betaR, betaM and sunE are view-independent - computed once per frame on the CPU
        // (see _updateAtmosphere) and supplied as uniforms.
        let betaR = uniform.procSkyBetaR;
        let betaM = uniform.procSkyBetaM;
        let sunE = uniform.procSkySunE;

        let zenithAngle = acos(max(0.0, dot(SKY_UP, dir)));
        let denom = cos(zenithAngle) + 0.15 * pow(max(93.885 - degrees(zenithAngle), 0.0), -1.253);
        let sR = SKY_RAYLEIGH_ZENITH / denom;
        let sM = SKY_MIE_ZENITH / denom;

        let Fex = exp(-(betaR * sR + betaM * sM));

        let cosTheta = dot(dir, sunDir);
        let betaRTheta = betaR * skyRayleighPhase(cosTheta * 0.5 + 0.5);
        let betaMTheta = betaM * skyHgPhase(cosTheta, uniform.procSkyMieG);
        let betaSum = betaR + betaM;

        var Lin = pow(sunE * ((betaRTheta + betaMTheta) / betaSum) * (vec3f(1.0) - Fex), vec3f(1.5));
        Lin = Lin * mix(
            vec3f(1.0),
            pow(sunE * ((betaRTheta + betaMTheta) / betaSum) * Fex, vec3f(0.5)),
            vec3f(clamp(pow(1.0 - dot(SKY_UP, sunDir), 5.0), 0.0, 1.0))
        );

        var L0 = vec3f(0.1) * Fex;
        let sundisk = smoothstep(SKY_SUN_ANGULAR_COS, SKY_SUN_ANGULAR_COS + 0.00002, cosTheta);
        L0 = L0 + sunE * 19000.0 * Fex * sundisk;

        let col = (Lin + L0) * 0.04 + vec3f(0.0, 0.0003, 0.00075);
        // Clamp the sun disc to a value the bloom can handle. The WebGPU bloom down/upsample
        // shaders sum 4 neighbour taps in f16 (half) before scaling, and accumulate mip levels
        // additively - so a very bright pixel overflows those intermediate f16 sums (max 65504)
        // to Inf/NaN and corrupts the whole screen. 6000 keeps every intermediate well in range.
        return min(col * uniform.procSkyLuminance, vec3f(6000.0));
    }
`;

// Override of the built-in `skyboxPS` chunk: renders the visible (infinite) skydome with the
// procedural model instead of sampling a cubemap / env-atlas. We keep the same includes, prepass
// branch and tonemap/expose/gamma output as the original so it composes identically with
// CameraFrame (HDR), exposure and tonemapping.
// Procedural night sky: a deep gradient, a warm twilight band at the set-sun azimuth, size- and
// brightness-varied hash stars, and a soft moon disk. Blended in by procSkyNightBlend. Only added
// to the visible sky (not the IBL bake), so it lives outside SKY_CORE.
const NIGHT_CORE_GLSL = /* glsl */ `
    uniform float procSkyNightBlend;       // 0 = day, 1 = night
    uniform vec3 procSkyNightColor;        // deep night sky base colour
    uniform float procSkyNightBrightness;
    uniform float procSkyStarBrightness;
    uniform float procSkyStarDensity;      // 0..1 fraction of cells holding a star
    uniform float procSkyStarSize;         // multiplier on the star radius
    uniform float procSkyTwilightGlow;
    uniform vec3 procSkyMoonDir;           // sky-space moon direction (matches the moonlight)
    uniform vec3 procSkyMoonColor;
    uniform float procSkyMoonSize;         // angular radius of the moon disk (radians)
    uniform float procSkyMoonGlow;

    float skyHash13(vec3 p3) {
        p3 = fract(p3 * 0.1031);
        p3 += dot(p3, p3.yzx + 33.33);
        return fract((p3.x + p3.y) * p3.z);
    }

    vec3 proceduralNight(vec3 dirIn) {
        vec3 dir = normalize(dirIn);

        // base gradient: darker overhead, a touch lighter near the horizon
        vec3 col = procSkyNightColor * procSkyNightBrightness * mix(1.1, 0.4, max(dir.y, 0.0));

        // twilight: a warm afterglow centered on the horizon point directly below the sun (the
        // sun's azimuth at the horizon), fading out as the sun sinks well below the horizon. Using
        // the angle to that single point gives a glow that sits ON the sunset position rather than
        // smearing along the whole horizon.
        vec3 sunH = normalize(vec3(procSkySunDir.x, 0.0, procSkySunDir.z) + vec3(1e-5, 0.0, 0.0));
        float toSun = max(dot(dir, sunH), 0.0);
        float belowFade = clamp(1.0 + procSkySunDir.y * 4.0, 0.0, 1.0);
        col += vec3(1.0, 0.45, 0.15) * (pow(toSun, 5.0) * belowFade * procSkyTwilightGlow);

        // stars: one candidate per grid cell sampled along the view direction, each with a random
        // size and brightness. The grid scale is low enough that stars are resolvable (not
        // sub-pixel), and the edge is anti-aliased against the pixel footprint (length(fwidth(p)))
        // so each star stays a stable ~1px+ dot and does not twinkle as the camera rotates.
        vec3 p = dir * 70.0;
        vec3 cell = floor(p);
        float present = step(1.0 - procSkyStarDensity, skyHash13(cell));
        vec3 sp = vec3(0.3) + 0.4 * vec3(skyHash13(cell + 11.0), skyHash13(cell + 23.0), skyHash13(cell + 37.0));
        float sizeRnd = skyHash13(cell + 53.0);
        float radius = mix(0.05, 0.22, sizeRnd * sizeRnd) * procSkyStarSize;   // biased small, with occasional larger stars
        float d = length(fract(p) - sp);
        float aa = length(fwidth(p)) + 1e-4;
        float star = present * mix(0.3, 1.0, skyHash13(cell + 71.0)) * (1.0 - smoothstep(radius - aa, radius + aa, d));
        col += vec3(star * procSkyStarBrightness * smoothstep(0.0, 0.04, dir.y));

        // moon: a small, fairly sharp disk with no surrounding glow (edge AA'd via fwidth)
        float c = dot(dir, normalize(procSkyMoonDir));
        float aaMoon = max(fwidth(c), 1e-5);
        float disk = smoothstep(cos(procSkyMoonSize) - aaMoon, cos(procSkyMoonSize) + aaMoon, c);
        col += procSkyMoonColor * procSkyMoonGlow * disk;

        return col;
    }
`;

const NIGHT_CORE_WGSL = /* wgsl */ `
    uniform procSkyNightBlend: f32;
    uniform procSkyNightColor: vec3f;
    uniform procSkyNightBrightness: f32;
    uniform procSkyStarBrightness: f32;
    uniform procSkyStarDensity: f32;
    uniform procSkyStarSize: f32;
    uniform procSkyTwilightGlow: f32;
    uniform procSkyMoonDir: vec3f;
    uniform procSkyMoonColor: vec3f;
    uniform procSkyMoonSize: f32;
    uniform procSkyMoonGlow: f32;

    fn skyHash13(p3in: vec3f) -> f32 {
        var p3 = fract(p3in * 0.1031);
        p3 = p3 + dot(p3, p3.yzx + 33.33);
        return fract((p3.x + p3.y) * p3.z);
    }

    fn proceduralNight(dirIn: vec3f) -> vec3f {
        let dir = normalize(dirIn);

        var col = uniform.procSkyNightColor * uniform.procSkyNightBrightness * mix(1.1, 0.4, max(dir.y, 0.0));

        let sunH = normalize(vec3f(uniform.procSkySunDir.x, 0.0, uniform.procSkySunDir.z) + vec3f(1e-5, 0.0, 0.0));
        let toSun = max(dot(dir, sunH), 0.0);
        let belowFade = clamp(1.0 + uniform.procSkySunDir.y * 4.0, 0.0, 1.0);
        col = col + vec3f(1.0, 0.45, 0.15) * (pow(toSun, 5.0) * belowFade * uniform.procSkyTwilightGlow);

        let p = dir * 70.0;
        let cell = floor(p);
        let present = step(1.0 - uniform.procSkyStarDensity, skyHash13(cell));
        let sp = vec3f(0.3) + 0.4 * vec3f(skyHash13(cell + 11.0), skyHash13(cell + 23.0), skyHash13(cell + 37.0));
        let sizeRnd = skyHash13(cell + 53.0);
        let radius = mix(0.05, 0.22, sizeRnd * sizeRnd) * uniform.procSkyStarSize;
        let d = length(fract(p) - sp);
        let aa = length(fwidth(p)) + 1e-4;
        let star = present * mix(0.3, 1.0, skyHash13(cell + 71.0)) * (1.0 - smoothstep(radius - aa, radius + aa, d));
        col = col + vec3f(star * uniform.procSkyStarBrightness * smoothstep(0.0, 0.04, dir.y));

        let c = dot(dir, normalize(uniform.procSkyMoonDir));
        let aaMoon = max(fwidth(c), 1e-5);
        let disk = smoothstep(cos(uniform.procSkyMoonSize) - aaMoon, cos(uniform.procSkyMoonSize) + aaMoon, c);
        col = col + uniform.procSkyMoonColor * uniform.procSkyMoonGlow * disk;

        return col;
    }
`;

const SKYBOX_OVERRIDE_GLSL = /* glsl */ `
    #define LIT_SKYBOX_INTENSITY

    #include "envProcPS"
    #include "gammaPS"
    #include "tonemappingPS"

    #ifdef PREPASS_PASS
        varying float vLinearDepth;
        #include "floatAsUintPS"
    #endif

    varying vec3 vViewDir;

    ${SKY_CORE_GLSL}
    ${NIGHT_CORE_GLSL}

    void main(void) {
        #ifdef PREPASS_PASS
            gl_FragColor = float2vec4(vLinearDepth);
        #else
            // flip X to match the engine's env-atlas sampling convention, so the visible sun and
            // the IBL reflections of the sun line up
            vec3 dir = normalize(vViewDir);
            dir.x *= -1.0;

            // blend the day model with the procedural night sky by the time-of-day night factor.
            // The branch is coherent (same value for every sky pixel), so only one model is
            // evaluated except during the brief twilight crossfade.
            vec3 linear;
            float nb = procSkyNightBlend;
            if (nb <= 0.0) {
                linear = proceduralSky(dir);
            } else if (nb >= 1.0) {
                linear = proceduralNight(dir);
            } else {
                linear = mix(proceduralSky(dir), proceduralNight(dir), nb);
            }

            gl_FragColor = vec4(gammaCorrectOutput(toneMap(processEnvironment(linear))), 1.0);
        #endif
    }
`;

const SKYBOX_OVERRIDE_WGSL = /* wgsl */ `
    #define LIT_SKYBOX_INTENSITY

    #include "envProcPS"
    #include "gammaPS"
    #include "tonemappingPS"

    #ifdef PREPASS_PASS
        varying vLinearDepth: f32;
        #include "floatAsUintPS"
    #endif

    varying vViewDir: vec3f;

    ${SKY_CORE_WGSL}
    ${NIGHT_CORE_WGSL}

    @fragment
    fn fragmentMain(input: FragmentInput) -> FragmentOutput {
        var output: FragmentOutput;
        #ifdef PREPASS_PASS
            output.color = float2vec4(input.vLinearDepth);
        #else
            var dir = normalize(input.vViewDir);
            dir.x = dir.x * -1.0;

            // coherent branch: only the day or the night model runs except during the crossfade
            var linear: vec3f;
            let nb = uniform.procSkyNightBlend;
            if (nb <= 0.0) {
                linear = proceduralSky(dir);
            } else if (nb >= 1.0) {
                linear = proceduralNight(dir);
            } else {
                linear = mix(proceduralSky(dir), proceduralNight(dir), nb);
            }

            output.color = vec4f(gammaCorrectOutput(toneMap(processEnvironment(linear))), 1.0);
        #endif
        return output;
    }
`;

// Fullscreen pass that renders the procedural sky into an equirectangular RGBM render target,
// which is then prefiltered by EnvLighting into the scene's env-atlas (the lighting source).
const EQUIRECT_VS_GLSL = /* glsl */ `
    attribute vec2 vertex_position;
    varying vec2 vUv0;
    void main(void) {
        gl_Position = vec4(vertex_position, 0.5, 1.0);
        vUv0 = vertex_position.xy * 0.5 + 0.5;
    }
`;

const EQUIRECT_VS_WGSL = /* wgsl */ `
    attribute vertex_position: vec2f;
    varying vUv0: vec2f;
    @vertex
    fn vertexMain(input: VertexInput) -> VertexOutput {
        var output: VertexOutput;
        output.position = vec4f(input.vertex_position, 0.5, 1.0);
        output.vUv0 = input.vertex_position.xy * 0.5 + 0.5;
        return output;
    }
`;

const EQUIRECT_FS_GLSL = /* glsl */ `
    varying vec2 vUv0;

    ${SKY_CORE_GLSL}

    // RGBM encode matching the engine's decodeRGBM (self contained - avoids relying on the
    // material pipeline's helpers such as saturate)
    vec4 encodeSkyRGBM(vec3 color) {
        vec3 c = pow(color, vec3(0.5)) * (1.0 / 8.0);
        float a = clamp(max(max(c.r, c.g), max(c.b, 1.0 / 255.0)), 0.0, 1.0);
        a = ceil(a * 255.0) / 255.0;
        return vec4(c / a, a);
    }

    void main(void) {
        // Map equirect uv -> direction so the baked equirect matches the orientation the engine's
        // reproject (sampleEquirect) expects. NOTE: the V flip differs between backends because
        // WebGPU renders to render targets Y-flipped while WebGL2 does not - see the WGSL variant.
        // This GLSL path only runs on WebGL2, so it uses (1.0 - vUv0.y).
        vec2 sph = (vec2(vUv0.x, 1.0 - vUv0.y) * 2.0 - 1.0) * vec2(PI_SKY, PI_SKY * 0.5);
        vec3 dir = vec3(cos(sph.y) * sin(sph.x), sin(sph.y), cos(sph.y) * cos(sph.x));
        gl_FragColor = encodeSkyRGBM(proceduralSky(dir));
    }
`;

const EQUIRECT_FS_WGSL = /* wgsl */ `
    varying vUv0: vec2f;

    ${SKY_CORE_WGSL}

    // RGBM encode matching the engine's decodeRGBM (self contained)
    fn encodeSkyRGBM(color: vec3f) -> vec4f {
        let c = pow(color, vec3f(0.5)) * (1.0 / 8.0);
        var a = clamp(max(max(c.r, c.g), max(c.b, 1.0 / 255.0)), 0.0, 1.0);
        a = ceil(a * 255.0) / 255.0;
        return vec4f(c / a, a);
    }

    @fragment
    fn fragmentMain(input: FragmentInput) -> FragmentOutput {
        var output: FragmentOutput;
        // This WGSL path only runs on WebGPU, which renders to render targets Y-flipped relative to
        // WebGL2. To make the baked equirect match the orientation the engine's reproject expects
        // (and so match the WebGL2 result), the V coordinate is NOT flipped here - the opposite of
        // the GLSL variant. Without this the IBL ambient samples the wrong hemisphere and the scene
        // renders too bright (shadows washed out) on WebGPU.
        let sph = (vec2f(input.vUv0.x, input.vUv0.y) * 2.0 - 1.0) * vec2f(PI_SKY, PI_SKY * 0.5);
        let dir = vec3f(cos(sph.y) * sin(sph.x), sin(sph.y), cos(sph.y) * cos(sph.x));
        output.color = encodeSkyRGBM(proceduralSky(dir));
        return output;
    }
`;

const tmpX = new Vec3();
const tmpZ = new Vec3();
const tmpSrc = new Vec3();
const tmpMoon = new Vec3();
const sunRotMat = new Mat4();
const sunRotQuat = new Quat();

/**
 * Renders a procedurally generated sky (analytic Preetham daylight) and uses it to drive the
 * scene's image-based lighting. The visible skydome reuses the engine's built-in infinite sky by
 * overriding its `skyboxPS` shader chunk, so no extra mesh is created. The env-atlas used for
 * ambient and reflections is regenerated only when the sun moves (or sky parameters change),
 * keeping it cheap enough to update continuously for a day/night cycle.
 *
 * An optional directional light is kept in sync with the sun, so direct lighting and shadows match
 * the visible sky and its image-based lighting.
 */
class ProceduralSky extends Script {
    static scriptName = 'proceduralSky';

    /**
     * The sun azimuth in degrees (compass direction).
     *
     * @attribute
     * @range [0, 360]
     * @type {number}
     */
    azimuth = 0;

    /**
     * The sun elevation in degrees above the horizon. Negative values place the sun below the
     * horizon (night).
     *
     * @attribute
     * @range [-90, 90]
     * @type {number}
     */
    elevation = 25;

    /**
     * Atmosphere haziness. Higher values give a milkier sky and a larger sun glow.
     *
     * @attribute
     * @range [1, 20]
     * @type {number}
     */
    turbidity = 2;

    /**
     * Rayleigh scattering amount, controls the overall blueness of the sky.
     *
     * @attribute
     * @range [0, 4]
     * @type {number}
     */
    rayleigh = 1.5;

    /**
     * Mie (aerosol) scattering amount, controls the brightness of the glow around the sun.
     *
     * @attribute
     * @range [0, 0.1]
     * @type {number}
     */
    mieCoefficient = 0.005;

    /**
     * Mie directional anisotropy, controls how tightly the glow hugs the sun.
     *
     * @attribute
     * @range [0, 1]
     * @type {number}
     */
    mieDirectionalG = 0.8;

    /**
     * Overall HDR luminance scale of the sky radiance.
     *
     * @attribute
     * @range [0, 4]
     * @type {number}
     */
    luminance = 1;

    /**
     * Resolution (height in texels) of the intermediate equirectangular sky used to generate the
     * lighting. The width is twice this. Small values are sufficient as the sky is low frequency.
     *
     * @attribute
     * @type {number}
     */
    lightingResolution = 128;

    /**
     * Size of the prefiltered env-atlas used for ambient and reflections.
     *
     * @attribute
     * @type {number}
     */
    atlasSize = 256;

    /**
     * The sun moves more than this many degrees before the (relatively cheaper) lighting is
     * regenerated. Keeps the cost down during a continuous day/night cycle.
     *
     * @attribute
     * @range [0, 10]
     * @type {number}
     */
    lightingThreshold = 0.5;

    /**
     * Optional directional light entity kept in sync with the sun direction, color and intensity.
     * The light's own `intensity` (set by the user) is captured once and used as the daytime peak -
     * the script then fades it out below the horizon and crossfades to the moonlight at night.
     *
     * @attribute
     * @type {Entity}
     */
    sunLight = null;

    /**
     * Daytime peak intensity, captured from the linked light's `intensity` on first use.
     *
     * @type {number|null}
     * @private
     */
    _baseSunIntensity = null;

    /**
     * Colour of the moonlight the directional light fades to once the sun is below the horizon.
     *
     * @attribute
     * @type {Color}
     */
    moonColor = new Color(0.792, 0.918, 1.0);

    /**
     * Intensity of the moonlight - the night key light, a dim cool light from above so the night
     * keeps subtle cool-toned shadows.
     *
     * @attribute
     * @range [0, 5]
     * @type {number}
     */
    moonIntensity = 1.0;

    /**
     * World-space direction towards the moon; the night key light comes from here (typically high
     * in the sky). Normalized internally.
     *
     * @attribute
     * @type {Vec3}
     */
    moonDirection = new Vec3(-1.53, 0.85, 0.35);

    /**
     * Deep night sky base colour.
     *
     * @attribute
     * @type {Color}
     */
    nightColor = new Color(0.114, 0.247, 0.408);

    /**
     * Overall brightness of the night sky gradient.
     *
     * @attribute
     * @range [0, 1]
     * @type {number}
     */
    nightBrightness = 0.052;

    /**
     * Star brightness (0 disables stars).
     *
     * @attribute
     * @range [0, 10]
     * @type {number}
     */
    starBrightness = 0.05;

    /**
     * Star density - fraction of sky cells that contain a star.
     *
     * @attribute
     * @range [0, 1]
     * @type {number}
     */
    starDensity = 0.8;

    /**
     * Star size multiplier applied to the per-star radius.
     *
     * @attribute
     * @range [0, 2]
     * @type {number}
     */
    starSize = 0.5;

    /**
     * Strength of the warm twilight glow at the horizon as the sun sits just below it.
     *
     * @attribute
     * @range [0, 5]
     * @type {number}
     */
    twilightGlow = 0.52;

    /**
     * Angular radius of the moon disk, in degrees.
     *
     * @attribute
     * @range [0, 10]
     * @type {number}
     */
    moonSize = 0.6;

    /**
     * Brightness of the moon disk in the night sky (tinted by moonColor).
     *
     * @attribute
     * @range [0, 20]
     * @type {number}
     */
    moonGlow = 3;

    /** @type {RenderTarget|null} */
    _equirectRT = null;

    /** @type {import('playcanvas').Shader|null} */
    _equirectShader = null;

    /** @type {Texture|null} */
    _lightingSource = null;

    /** @type {Texture|null} */
    _envAtlas = null;

    /** @private */
    _origSkyboxGLSL = null;

    /** @private */
    _origSkyboxWGSL = null;

    /** the sky-space sun direction last used for a lighting bake */
    _bakedDir = new Vec3(0, -1, 0);

    /** signature of the sky parameters last used for a lighting bake */
    _bakedParams = '';

    /** reused world-space sun direction */
    _sunDir = new Vec3();

    /** reused sky-space sun direction (world with X flipped) */
    _skyDir = new Vec3();

    _warmColor = new Color(1.0, 0.6, 0.35);

    _zenithColor = new Color(1.0, 1.0, 0.98);

    _sunColor = new Color();

    initialize() {
        const device = this.app.graphicsDevice;

        // override the built-in sky fragment shader so the engine's own infinite skydome renders
        // our procedural sky. Remember the originals so we can restore them on destroy.
        const glsl = ShaderChunks.get(device, SHADERLANGUAGE_GLSL);
        const wgsl = ShaderChunks.get(device, SHADERLANGUAGE_WGSL);
        this._origSkyboxGLSL = glsl.get('skyboxPS');
        this._origSkyboxWGSL = wgsl.get('skyboxPS');
        glsl.set('skyboxPS', SKYBOX_OVERRIDE_GLSL);
        wgsl.set('skyboxPS', SKYBOX_OVERRIDE_WGSL);

        // shader for the equirectangular sky -> lighting source pass
        this._equirectShader = ShaderUtils.createShader(device, {
            uniqueName: 'ProceduralSkyEquirect',
            attributes: { vertex_position: SEMANTIC_POSITION },
            vertexGLSL: EQUIRECT_VS_GLSL,
            fragmentGLSL: EQUIRECT_FS_GLSL,
            vertexWGSL: EQUIRECT_VS_WGSL,
            fragmentWGSL: EQUIRECT_FS_WGSL
        });

        // force a lighting bake on the first update
        this._bakedParams = '';

        this.on('destroy', this._onDestroy, this);
    }

    /** @private */
    _allocResources() {
        const device = this.app.graphicsDevice;
        const h = Math.max(8, Math.floor(this.lightingResolution));
        const w = h * 2;

        // RGBM equirect render target - RGBA8 works on every device (no float-renderable needed)
        const colorBuffer = new Texture(device, {
            name: 'procedural-sky-equirect',
            width: w,
            height: h,
            format: PIXELFORMAT_RGBA8,
            type: TEXTURETYPE_RGBM,
            projection: TEXTUREPROJECTION_EQUIRECT,
            addressU: ADDRESS_CLAMP_TO_EDGE,
            addressV: ADDRESS_CLAMP_TO_EDGE,
            minFilter: FILTER_LINEAR,
            magFilter: FILTER_LINEAR,
            mipmaps: false
        });
        this._equirectRT = new RenderTarget({
            name: 'procedural-sky-equirect-rt',
            colorBuffer,
            depth: false
        });
    }

    /**
     * Computes the world-space direction towards the sun from the azimuth / elevation.
     *
     * @param {Vec3} out - The vector to receive the result.
     * @returns {Vec3} The world-space sun direction.
     * @private
     */
    _computeSunDir(out) {
        const el = this.elevation * Math.PI / 180;
        const az = this.azimuth * Math.PI / 180;
        const cosEl = Math.cos(el);
        return out.set(cosEl * Math.sin(az), Math.sin(el), cosEl * Math.cos(az)).normalize();
    }

    /**
     * Computes the view-independent atmosphere terms (rayleigh/mie scattering coefficients and sun
     * intensity) and uploads them as uniforms. These are constant across the whole sky, so doing
     * them once per frame here avoids recomputing them for every sky pixel in the shader. (three.js
     * does the equivalent in its vertex shader; on the CPU is cheaper still since they don't vary
     * per vertex either.)
     *
     * @param {object} scope - The device scope to set the uniforms on.
     * @private
     */
    _updateAtmosphere(scope) {
        const sunY = this._skyDir.y; // = sin(elevation) = dot(sunDir, up)

        // rayleigh
        const sunfade = 1.0 - Math.min(Math.max(1.0 - Math.exp(sunY), 0), 1);
        const rayleighCoeff = this.rayleigh - (1.0 - sunfade);
        scope.resolve('procSkyBetaR').setValue([
            SKY_TOTAL_RAYLEIGH[0] * rayleighCoeff,
            SKY_TOTAL_RAYLEIGH[1] * rayleighCoeff,
            SKY_TOTAL_RAYLEIGH[2] * rayleighCoeff
        ]);

        // mie
        const mieC = 0.434 * (0.2 * this.turbidity * 1e-18) * this.mieCoefficient;
        scope.resolve('procSkyBetaM').setValue([
            SKY_MIE_CONST[0] * mieC,
            SKY_MIE_CONST[1] * mieC,
            SKY_MIE_CONST[2] * mieC
        ]);

        // sun intensity
        const zenithCos = Math.max(-1, Math.min(1, sunY));
        scope.resolve('procSkySunE').setValue(
            SKY_EE * Math.max(0, 1.0 - Math.exp(-((SKY_CUTOFF - Math.acos(zenithCos)) / SKY_STEEPNESS)))
        );
    }

    /**
     * Regenerates the equirect sky and prefilters it into the env-atlas used for lighting.
     *
     * @private
     */
    _bakeLighting() {
        const device = this.app.graphicsDevice;

        if (!this._equirectRT) {
            this._allocResources();
        }

        // render the procedural sky into the equirect RGBM target (uniforms are already set on the
        // device scope by update())
        drawQuadWithShader(device, this._equirectRT, this._equirectShader);

        // prefilter into a lighting source cubemap and then the env-atlas, reusing the targets
        this._lightingSource = EnvLighting.generateLightingSource(this._equirectRT.colorBuffer, {
            target: this._lightingSource,
            size: 64
        });

        const firstBake = !this._envAtlas;
        this._envAtlas = EnvLighting.generateAtlas(this._lightingSource, {
            target: this._envAtlas,
            size: this.atlasSize,
            numReflectionSamples: 256,
            numAmbientSamples: 512
        });

        // assign once - later bakes reuse the same texture object, so materials pick up the new
        // content without recreating the sky mesh
        if (firstBake) {
            this.app.scene.envAtlas = this._envAtlas;
        }
    }

    /** @private */
    _updateSunLight() {
        const light = this.sunLight?.light;
        if (!light) return;

        // capture the user-authored light intensity as the daytime peak (before we start
        // overwriting it each frame)
        if (this._baseSunIntensity === null) {
            this._baseSunIntensity = light.intensity;
        }

        // crossfade the key light from the sun (day) to the dim cold moon from above (night)
        const nightFactor = Math.max(0, Math.min(1, (3 - this.elevation) / 6));

        // light source direction: towards the sun by day, towards the moon by night
        tmpMoon.copy(this.moonDirection).normalize();
        const src = tmpSrc.lerp(this._sunDir, tmpMoon, nightFactor).normalize();

        // A directional light emits along its entity's -Y (down) axis (see forward-renderer:
        // `wtm.getY(_direction).mulScalar(-1)`). Orient the entity so its +Y axis points towards
        // the light source, so the light travels along -src (from the source into the scene).
        // (lookAt would set the -Z axis instead, leaving the light pointing roughly straight down.)
        const ref = Math.abs(src.y) > 0.99 ? Vec3.RIGHT : Vec3.UP;
        tmpX.cross(src, ref).normalize();
        tmpZ.cross(tmpX, src).normalize();
        sunRotMat.set([
            tmpX.x, tmpX.y, tmpX.z, 0,
            src.x, src.y, src.z, 0,
            tmpZ.x, tmpZ.y, tmpZ.z, 0,
            0, 0, 0, 1
        ]);
        sunRotQuat.setFromMat4(sunRotMat);
        this.sunLight.setRotation(sunRotQuat);

        // colour: warm -> white sun by day, cold moon by night
        const y = this._sunDir.y;
        const t = Math.max(0, Math.min(1, y / 0.4));
        this._sunColor.lerp(this._warmColor, this._zenithColor, t);
        this._sunColor.lerp(this._sunColor, this.moonColor, nightFactor);
        light.color = this._sunColor;

        // intensity: the sun fades out below the horizon while the moon fades in
        const sunPart = this._baseSunIntensity * Math.max(0, Math.min(1, y / 0.1));
        const moonPart = this.moonIntensity * nightFactor;
        light.intensity = sunPart + moonPart;
    }

    update(dt) {
        const device = this.app.graphicsDevice;

        // world-space sun direction, and sky-space direction (X flipped to match the engine's
        // env-atlas sampling convention used by the visible sky and reflections)
        this._computeSunDir(this._sunDir);
        this._skyDir.set(-this._sunDir.x, this._sunDir.y, this._sunDir.z);

        // push sky uniforms to the global scope - read by both the visible skybox and the
        // equirect lighting pass
        const scope = device.scope;
        scope.resolve('procSkySunDir').setValue([this._skyDir.x, this._skyDir.y, this._skyDir.z]);
        this._updateAtmosphere(scope);
        scope.resolve('procSkyMieG').setValue(this.mieDirectionalG);
        scope.resolve('procSkyLuminance').setValue(this.luminance);

        // night sky: blend factor from the sun elevation (day above +2 deg, night below -8 deg),
        // plus the night layer parameters. The moon disk reuses the moon light direction/colour.
        scope.resolve('procSkyNightBlend').setValue(Math.max(0, Math.min(1, (2 - this.elevation) / 10)));
        scope.resolve('procSkyNightColor').setValue([this.nightColor.r, this.nightColor.g, this.nightColor.b]);
        scope.resolve('procSkyNightBrightness').setValue(this.nightBrightness);
        scope.resolve('procSkyStarBrightness').setValue(this.starBrightness);
        scope.resolve('procSkyStarDensity').setValue(this.starDensity);
        scope.resolve('procSkyStarSize').setValue(this.starSize);
        scope.resolve('procSkyTwilightGlow').setValue(this.twilightGlow);
        scope.resolve('procSkyMoonColor').setValue([this.moonColor.r, this.moonColor.g, this.moonColor.b]);
        scope.resolve('procSkyMoonSize').setValue(this.moonSize * Math.PI / 180);
        scope.resolve('procSkyMoonGlow').setValue(this.moonGlow);
        tmpMoon.copy(this.moonDirection).normalize();
        scope.resolve('procSkyMoonDir').setValue([-tmpMoon.x, tmpMoon.y, tmpMoon.z]);

        this._updateSunLight();

        // regenerate the lighting only when the sun moved enough or the sky parameters changed
        const params = `${this.rayleigh}|${this.turbidity}|${this.mieCoefficient}|${this.mieDirectionalG}|${this.luminance}|${this.atlasSize}|${this.lightingResolution}`;
        const cosThreshold = Math.cos(this.lightingThreshold * Math.PI / 180);
        const moved = this._skyDir.dot(this._bakedDir) < cosThreshold;
        if (moved || params !== this._bakedParams) {
            this._bakeLighting();
            this._bakedDir.copy(this._skyDir);
            this._bakedParams = params;
        }
    }

    /** @private */
    _onDestroy() {
        const device = this.app.graphicsDevice;

        // restore the original sky shader chunks
        if (this._origSkyboxGLSL !== null) {
            ShaderChunks.get(device, SHADERLANGUAGE_GLSL).set('skyboxPS', this._origSkyboxGLSL);
        }
        if (this._origSkyboxWGSL !== null) {
            ShaderChunks.get(device, SHADERLANGUAGE_WGSL).set('skyboxPS', this._origSkyboxWGSL);
        }

        if (this.app.scene.envAtlas === this._envAtlas) {
            this.app.scene.envAtlas = null;
        }

        this._equirectRT?.colorBuffer?.destroy();
        this._equirectRT?.destroy();
        this._lightingSource?.destroy();
        this._envAtlas?.destroy();
        this._equirectRT = null;
        this._lightingSource = null;
        this._envAtlas = null;
    }
}

export { ProceduralSky };
