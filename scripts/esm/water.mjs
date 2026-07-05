import {
    Script,
    Entity,
    Color,
    Texture,
    Vec3,
    ShaderMaterial,
    ShaderChunks,
    BLEND_NORMAL,
    CULLFACE_NONE,
    FOG_NONE,
    PIXELFORMAT_RGBA8,
    SEMANTIC_POSITION,
    SHADERLANGUAGE_GLSL,
    SHADERLANGUAGE_WGSL,
    LAYERID_DEPTH,
    LAYERID_UI
} from 'playcanvas';

import { PlanarRenderer } from './planar-renderer.mjs';

// devices with the global water shader chunks already installed
const _chunksInstalled = new WeakSet();

/**
 * Installs global shader chunk overrides used by the water on other materials in the scene:
 *
 * - fog is gated per pixel to fragments below the water level (define WATER_HEIGHT_FOG on the
 *   receiving material), so an underwater fog color does not fog the world above the surface.
 * - animated caustics are applied to fragments below the water level (define WATER_CAUSTICS on
 *   the receiving material), fading out with depth and following the directional light.
 *
 * The water script provides the global uniforms these use (waterLevel, waterTime,
 * waterCausticsMap, waterCausticsParams, waterCausticsColor).
 *
 * @param {import('playcanvas').GraphicsDevice} device - The graphics device.
 */
function setupWaterWorldChunks(device) {
    if (_chunksInstalled.has(device)) return;
    _chunksInstalled.add(device);

    // fog chunk override - matches the engine 'fogPS' chunk, with a per-pixel height gate
    const glslChunks = ShaderChunks.get(device, SHADERLANGUAGE_GLSL);
    glslChunks.set('fogPS', /* glsl */`
        float dBlendModeFogFactor = 1.0;

        #if (FOG != NONE)
            uniform vec3 fog_color;

            #if (FOG == LINEAR)
                uniform float fog_start;
                uniform float fog_end;
            #else
                uniform float fog_density;
            #endif
        #endif

        #ifdef WATER_HEIGHT_FOG
            uniform float waterFogLevel;
        #endif

        #ifdef VERTEXSHADER
            float getFogFactor(float depth) {
        #else
            float getFogFactor() {
                float depth = gl_FragCoord.z / gl_FragCoord.w;
        #endif

            float fogFactor = 0.0;

            #if (FOG == LINEAR)
                fogFactor = (fog_end - depth) / (fog_end - fog_start);
            #elif (FOG == EXP)
                fogFactor = exp(-depth * fog_density);
            #elif (FOG == EXP2)
                fogFactor = exp(-depth * depth * fog_density * fog_density);
            #endif

            return clamp(fogFactor, 0.0, 1.0);
        }

        #ifdef VERTEXSHADER
            vec3 addFog(vec3 color, float depth) {
                #if (FOG != NONE)
                    return mix(fog_color * dBlendModeFogFactor, color, getFogFactor(depth));
                #endif
                return color;
            }
        #else
            vec3 addFog(vec3 color) {
                #if (FOG != NONE)
                    float fogFactor = getFogFactor();
                    #ifdef WATER_HEIGHT_FOG
                        // no fog above the water level, soft blend across the waterline
                        float below = clamp((waterFogLevel - vPositionW.y) * 4.0, 0.0, 1.0);
                        fogFactor = mix(1.0, fogFactor, below);
                    #endif
                    return mix(fog_color * dBlendModeFogFactor, color, fogFactor);
                #endif
                return color;
            }
        #endif
    `);

    glslChunks.set('litUserDeclarationPS', /* glsl */`
        #if defined(WATER_CAUSTICS) && !defined(SHADOW_PASS) && !defined(PICK_PASS) && !defined(PREPASS_PASS)
            uniform float waterLevel;
            uniform sampler2D waterCausticsMap;
            uniform vec4 waterCausticsParams; // x: tiling, y: speed, z: strength, w: fade depth
            uniform vec3 waterCausticsColor;
            uniform float waterTime;
        #endif
    `);

    glslChunks.set('litUserMainEndPS', /* glsl */`
        #if defined(WATER_CAUSTICS) && !defined(SHADOW_PASS) && !defined(PICK_PASS) && !defined(PREPASS_PASS)
        {
            float depthBelow = waterLevel - vPositionW.y;
            if (depthBelow > 0.0) {
                vec2 cuv = vPositionW.xz * waterCausticsParams.x;
                float ct = waterTime * waterCausticsParams.y;
                float ca = texture2D(waterCausticsMap, cuv + vec2(ct, ct * 0.8)).x;
                float cb = texture2D(waterCausticsMap, cuv * 1.37 + vec2(-ct * 1.1, ct * 0.9)).y;
                float caustic = pow(clamp((ca + cb) * 0.5 * 2.2 - 0.9, 0.0, 1.0), 2.0);

                // fade in just below the waterline, fade out with depth, favor up-facing surfaces
                float gate = exp(-depthBelow / waterCausticsParams.w) * min(depthBelow * 4.0, 1.0);
                gate *= clamp(litArgs_worldNormal.y, 0.0, 1.0);
                gl_FragColor.rgb *= vec3(1.0) + waterCausticsColor * (caustic * waterCausticsParams.z * gate);
            }
        }
        #endif
    `);

    // WGSL equivalents
    const wgslChunks = ShaderChunks.get(device, SHADERLANGUAGE_WGSL);
    wgslChunks.set('fogPS', /* wgsl */`
        #include "fogMathPS"

        var<private> dBlendModeFogFactor : f32 = 1.0;

        #if (FOG != NONE)
            uniform fog_color : vec3f;

            #if (FOG == LINEAR)
                uniform fog_start : f32;
                uniform fog_end : f32;
            #else
                uniform fog_density : f32;
            #endif
        #endif

        #ifdef WATER_HEIGHT_FOG
            uniform waterFogLevel : f32;
        #endif

        #ifdef VERTEXSHADER
            fn getFogFactor(depth: f32) -> f32 {
        #else
            fn getFogFactor() -> f32 {
                let depth = pcPosition.z / pcPosition.w;
        #endif

            #if (FOG == LINEAR)
                return evaluateFogFactorLinear(depth, uniform.fog_start, uniform.fog_end);
            #elif (FOG == EXP)
                return evaluateFogFactorExp(depth, uniform.fog_density);
            #elif (FOG == EXP2)
                return evaluateFogFactorExp2(depth, uniform.fog_density);
            #else
                return 1.0;
            #endif
        }

        #ifdef VERTEXSHADER
            fn addFog(color: vec3f, depth: f32) -> vec3f {
                #if (FOG != NONE)
                    return mix(uniform.fog_color * dBlendModeFogFactor, color, getFogFactor(depth));
                #else
                    return color;
                #endif
            }
        #else
            fn addFog(color: vec3f) -> vec3f {
                #if (FOG != NONE)
                    var fogFactor = getFogFactor();
                    #ifdef WATER_HEIGHT_FOG
                        // no fog above the water level, soft blend across the waterline
                        let below = clamp((uniform.waterFogLevel - vPositionW.y) * 4.0, 0.0, 1.0);
                        fogFactor = mix(1.0, fogFactor, below);
                    #endif
                    return mix(uniform.fog_color * dBlendModeFogFactor, color, fogFactor);
                #else
                    return color;
                #endif
            }
        #endif
    `);

    wgslChunks.set('litUserDeclarationPS', /* wgsl */`
        #if defined(WATER_CAUSTICS) && !defined(SHADOW_PASS) && !defined(PICK_PASS) && !defined(PREPASS_PASS)
            uniform waterLevel : f32;
            var waterCausticsMap : texture_2d<f32>;
            var waterCausticsMapSampler : sampler;
            uniform waterCausticsParams : vec4f; // x: tiling, y: speed, z: strength, w: fade depth
            uniform waterCausticsColor : vec3f;
            uniform waterTime : f32;
        #endif
    `);

    wgslChunks.set('litUserMainEndPS', /* wgsl */`
        #if defined(WATER_CAUSTICS) && !defined(SHADOW_PASS) && !defined(PICK_PASS) && !defined(PREPASS_PASS)
        {
            // no branch here - textureSample requires uniform control flow in WGSL
            let depthBelow: f32 = uniform.waterLevel - vPositionW.y;
            let cuv: vec2f = vPositionW.xz * uniform.waterCausticsParams.x;
            let ct: f32 = uniform.waterTime * uniform.waterCausticsParams.y;
            let ca: f32 = textureSample(waterCausticsMap, waterCausticsMapSampler, cuv + vec2f(ct, ct * 0.8)).x;
            let cb: f32 = textureSample(waterCausticsMap, waterCausticsMapSampler, cuv * 1.37 + vec2f(-ct * 1.1, ct * 0.9)).y;
            let caustic: f32 = pow(clamp((ca + cb) * 0.5 * 2.2 - 0.9, 0.0, 1.0), 2.0);

            // fade in just below the waterline, fade out with depth, favor up-facing surfaces
            var gate: f32 = exp(-max(depthBelow, 0.0) / uniform.waterCausticsParams.w) * clamp(depthBelow * 4.0, 0.0, 1.0);
            gate *= clamp(litArgs_worldNormal.y, 0.0, 1.0);
            output.color = vec4f(output.color.rgb * (vec3f(1.0) + uniform.waterCausticsColor * (caustic * uniform.waterCausticsParams.z * gate)), output.color.a);
        }
        #endif
    `);
}

// Reusable objects to avoid allocations
const _flippedNormal = new Vec3();

// ----------------------
// Shared wave functions - Gerstner waves, 3 octaves derived from the main direction
// ----------------------

const waveFunctionsGLSL = /* glsl */`
    #ifdef WATER_WAVES
        uniform vec4 uWaveParams;  // x: amplitude, y: frequency, z: speed, w: steepness
        uniform vec2 uWaveDir;
        uniform vec4 uSwellParams; // x: amplitude, y: frequency, z: speed, w: steepness
        uniform vec2 uSwellDir;
        uniform float uTime;

        // per wave octave: x: direction angle offset (rad), y: amplitude mult, z: frequency mult,
        // w: speed mult. Irrational-ish frequency ratios and irregular directions and phases avoid
        // a visible repeating interference pattern.
        const int CHOP_COUNT = 3;
        const vec4 CHOP_OCTAVES[CHOP_COUNT] = vec4[CHOP_COUNT](
            vec4( 0.00, 1.00, 1.00, 1.00),
            vec4( 0.41, 0.55, 1.73, 0.87),
            vec4(-0.87, 0.32, 2.61, 0.79)
        );
        const int SWELL_COUNT = 2;
        const vec4 SWELL_OCTAVES[SWELL_COUNT] = vec4[SWELL_COUNT](
            vec4( 0.00, 1.00, 1.00, 1.00),
            vec4(-0.51, 0.65, 0.63, 1.13)
        );

        vec2 waveRotate(vec2 v, float a) {
            float c = cos(a);
            float s = sin(a);
            return vec2(c * v.x - s * v.y, s * v.x + c * v.y);
        }

        // slowly varying spatial amplitude envelope, different per octave - stops the wave field
        // from looking uniform and repeating over large distances
        float waveEnvelope(vec2 p, vec2 dir, float freq, float seed) {
            vec2 envDir = waveRotate(dir, 1.07);
            return 0.55 + 0.45 * sin(freq * 0.17 * dot(envDir, p) + seed * 4.7);
        }

        vec3 gerstnerDisplace(vec2 p, vec4 octave, vec4 params, vec2 mainDir, float seed) {
            vec2 dir = waveRotate(mainDir, octave.x);
            float freq = params.y * octave.z;
            float amp = params.x * octave.y * waveEnvelope(p, dir, freq, seed);
            float th = freq * dot(dir, p) + params.z * octave.w * freq * uTime + seed * 2.3;
            return vec3(dir.x * params.w * amp * cos(th), amp * sin(th), dir.y * params.w * amp * cos(th));
        }

        vec3 gerstnerNormal(vec2 p, vec4 octave, vec4 params, vec2 mainDir, float seed) {
            vec2 dir = waveRotate(mainDir, octave.x);
            float freq = params.y * octave.z;
            float amp = params.x * octave.y * waveEnvelope(p, dir, freq, seed);
            float th = freq * dot(dir, p) + params.z * octave.w * freq * uTime + seed * 2.3;
            return vec3(-dir.x * freq * amp * cos(th), -params.w * freq * amp * sin(th), -dir.y * freq * amp * cos(th));
        }

        vec3 waveDisplacement(vec2 p) {
            vec3 d = vec3(0.0);
            for (int i = 0; i < CHOP_COUNT; i++) {
                d += gerstnerDisplace(p, CHOP_OCTAVES[i], uWaveParams, uWaveDir, float(i));
            }
            for (int i = 0; i < SWELL_COUNT; i++) {
                d += gerstnerDisplace(p, SWELL_OCTAVES[i], uSwellParams, uSwellDir, float(i) + 5.0);
            }
            return d;
        }

        vec3 waveNormal(vec2 p) {
            vec3 n = vec3(0.0, 1.0, 0.0);
            for (int i = 0; i < CHOP_COUNT; i++) {
                n += gerstnerNormal(p, CHOP_OCTAVES[i], uWaveParams, uWaveDir, float(i));
            }
            for (int i = 0; i < SWELL_COUNT; i++) {
                n += gerstnerNormal(p, SWELL_OCTAVES[i], uSwellParams, uSwellDir, float(i) + 5.0);
            }
            return n;
        }
    #endif
`;

const waveFunctionsWGSL = /* wgsl */`
    #ifdef WATER_WAVES
        uniform uWaveParams: vec4f;  // x: amplitude, y: frequency, z: speed, w: steepness
        uniform uWaveDir: vec2f;
        uniform uSwellParams: vec4f; // x: amplitude, y: frequency, z: speed, w: steepness
        uniform uSwellDir: vec2f;
        uniform uTime: f32;

        // per wave octave: x: direction angle offset (rad), y: amplitude mult, z: frequency mult,
        // w: speed mult. Irrational-ish frequency ratios and irregular directions and phases avoid
        // a visible repeating interference pattern.
        const CHOP_COUNT: i32 = 3;
        const CHOP_OCTAVES = array<vec4f, 3>(
            vec4f( 0.00, 1.00, 1.00, 1.00),
            vec4f( 0.41, 0.55, 1.73, 0.87),
            vec4f(-0.87, 0.32, 2.61, 0.79)
        );
        const SWELL_COUNT: i32 = 2;
        const SWELL_OCTAVES = array<vec4f, 2>(
            vec4f( 0.00, 1.00, 1.00, 1.00),
            vec4f(-0.51, 0.65, 0.63, 1.13)
        );

        fn waveRotate(v: vec2f, a: f32) -> vec2f {
            let c: f32 = cos(a);
            let s: f32 = sin(a);
            return vec2f(c * v.x - s * v.y, s * v.x + c * v.y);
        }

        // slowly varying spatial amplitude envelope, different per octave - stops the wave field
        // from looking uniform and repeating over large distances
        fn waveEnvelope(p: vec2f, dir: vec2f, freq: f32, seed: f32) -> f32 {
            let envDir: vec2f = waveRotate(dir, 1.07);
            return 0.55 + 0.45 * sin(freq * 0.17 * dot(envDir, p) + seed * 4.7);
        }

        fn gerstnerDisplace(p: vec2f, octave: vec4f, params: vec4f, mainDir: vec2f, seed: f32) -> vec3f {
            let dir: vec2f = waveRotate(mainDir, octave.x);
            let freq: f32 = params.y * octave.z;
            let amp: f32 = params.x * octave.y * waveEnvelope(p, dir, freq, seed);
            let th: f32 = freq * dot(dir, p) + params.z * octave.w * freq * uniform.uTime + seed * 2.3;
            return vec3f(dir.x * params.w * amp * cos(th), amp * sin(th), dir.y * params.w * amp * cos(th));
        }

        fn gerstnerNormal(p: vec2f, octave: vec4f, params: vec4f, mainDir: vec2f, seed: f32) -> vec3f {
            let dir: vec2f = waveRotate(mainDir, octave.x);
            let freq: f32 = params.y * octave.z;
            let amp: f32 = params.x * octave.y * waveEnvelope(p, dir, freq, seed);
            let th: f32 = freq * dot(dir, p) + params.z * octave.w * freq * uniform.uTime + seed * 2.3;
            return vec3f(-dir.x * freq * amp * cos(th), -params.w * freq * amp * sin(th), -dir.y * freq * amp * cos(th));
        }

        fn waveDisplacement(p: vec2f) -> vec3f {
            var d: vec3f = vec3f(0.0);
            for (var i: i32 = 0; i < CHOP_COUNT; i++) {
                d += gerstnerDisplace(p, CHOP_OCTAVES[i], uniform.uWaveParams, uniform.uWaveDir, f32(i));
            }
            for (var i: i32 = 0; i < SWELL_COUNT; i++) {
                d += gerstnerDisplace(p, SWELL_OCTAVES[i], uniform.uSwellParams, uniform.uSwellDir, f32(i) + 5.0);
            }
            return d;
        }

        fn waveNormal(p: vec2f) -> vec3f {
            var n: vec3f = vec3f(0.0, 1.0, 0.0);
            for (var i: i32 = 0; i < CHOP_COUNT; i++) {
                n += gerstnerNormal(p, CHOP_OCTAVES[i], uniform.uWaveParams, uniform.uWaveDir, f32(i));
            }
            for (var i: i32 = 0; i < SWELL_COUNT; i++) {
                n += gerstnerNormal(p, SWELL_OCTAVES[i], uniform.uSwellParams, uniform.uSwellDir, f32(i) + 5.0);
            }
            return n;
        }
    #endif
`;

// ----------------------
// GLSL Shaders
// ----------------------

const vertexGLSL = /* glsl */`
    #ifdef WATER_DEPTH_EFFECTS
        #include "screenDepthPS"
    #endif

    attribute vec3 vertex_position;

    uniform mat4 matrix_model;
    uniform mat4 matrix_viewProjection;

    varying vec3 vWorldPos;
    varying vec4 vScreenPos;
    #ifdef WATER_WAVES
        varying vec2 vWavePos;
    #endif
    #ifdef WATER_DEPTH_EFFECTS
        varying float vViewDepth;
    #endif

    ${waveFunctionsGLSL}

    void main(void) {
        vec4 worldPos = matrix_model * vec4(vertex_position, 1.0);

        #ifdef WATER_WAVES
            vWavePos = worldPos.xz;
            worldPos.xyz += waveDisplacement(worldPos.xz);
        #endif

        vWorldPos = worldPos.xyz;

        vec4 projPos = matrix_viewProjection * worldPos;
        gl_Position = projPos;
        vScreenPos = projPos;

        #ifdef WATER_DEPTH_EFFECTS
            vViewDepth = getLinearDepth(worldPos.xyz);
        #endif
    }
`;

const fragmentGLSL = /* glsl */`
    #include "gammaPS"
    #ifdef WATER_DEPTH_EFFECTS
        #include "screenDepthPS"
    #endif
    #ifdef WATER_REFLECTION_SKY
        #include "decodePS"
        #include "envAtlasPS"
        #include "sphericalPS"
    #endif

    #ifndef SCREENSIZE
        #define SCREENSIZE
        uniform vec4 uScreenSize;
    #endif

    uniform sampler2D uNormalMap;
    #ifdef WATER_REFLECTION_PLANAR
        uniform sampler2D uReflectionMap;
    #endif
    #ifdef WATER_REFLECTION_SKY
        uniform sampler2D texture_envAtlas;
        uniform float uSkyBlur;
    #endif
    #ifdef WATER_REFRACTION
        uniform sampler2D uRefractionMap;
    #endif

    uniform vec3 view_position;
    #ifndef WATER_WAVES
        uniform float uTime;
    #endif

    uniform vec3 uShallowColor;
    uniform vec3 uDeepColor;
    uniform vec3 uLightDir;
    uniform vec3 uLightColor;
    uniform float uRippleTiling;
    uniform float uRippleSpeed;
    uniform float uBumpiness;
    uniform float uDistortion;
    uniform float uFresnelPower;
    uniform float uReflectionStrength;
    uniform float uDepthFade;
    uniform float uShoreSoftness;
    uniform float uOpacity;
    uniform float uSpecularPower;
    uniform float uSpecularIntensity;
    uniform float uDiffuseIntensity;
    uniform float uUnderwaterFogDensity;
    uniform vec3 uUnderwaterFogColor;
    uniform float uCameraBelow;
    uniform float uSnellWindow;
    #ifdef WATER_FOAM
        uniform vec3 uFoamColor;
        uniform float uFoamDepth;
    #endif

    varying vec3 vWorldPos;
    varying vec4 vScreenPos;
    #ifdef WATER_WAVES
        varying vec2 vWavePos;
    #endif
    #ifdef WATER_DEPTH_EFFECTS
        varying float vViewDepth;
    #endif

    ${waveFunctionsGLSL}

    void main(void) {

        // two layers of scrolling detail normals, in tangent space of a horizontal plane. The
        // second layer is rotated, so the tiling of the two never lines up into a visible grid.
        vec2 baseUv = vWorldPos.xz * uRippleTiling;
        float st = uTime * uRippleSpeed;
        vec2 rotUv = vec2(0.79 * baseUv.x - 0.61 * baseUv.y, 0.61 * baseUv.x + 0.79 * baseUv.y);
        vec3 nm1 = texture2D(uNormalMap, baseUv + vec2(st, st * 0.7)).xyz * 2.0 - 1.0;
        vec3 nm2 = texture2D(uNormalMap, rotUv * 1.73 + vec2(-st * 0.8, st * 1.1)).xyz * 2.0 - 1.0;
        vec2 detail = (nm1.xy + nm2.xy) * 0.5 * uBumpiness;

        // combine with the geometry wave normal
        #ifdef WATER_WAVES
            vec3 waveN = waveNormal(vWavePos);
        #else
            vec3 waveN = vec3(0.0, 1.0, 0.0);
        #endif
        vec3 N = normalize(vec3(waveN.x + detail.x, waveN.y, waveN.z + detail.y));

        vec3 V = normalize(view_position - vWorldPos);
        float NdotV = max(dot(N, V), 0.0);

        // screen uv to sample the planar textures. The refraction camera matches the main camera,
        // so its texture is sampled without a flip; the reflection camera is mirrored by the
        // water plane, which flips the image vertically.
        vec2 screenUV = gl_FragCoord.xy * uScreenSize.zw;
        vec2 refractionUV = screenUV + N.xz * uDistortion;
        vec2 reflectionUV = vec2(screenUV.x, 1.0 - screenUV.y) + N.xz * uDistortion;

        // sample the planar / sky reflection textures up front, before any divergent flow
        // (WGSL uniformity). Both the distorted and undistorted refraction samples are taken -
        // the undistorted one is the fallback when the distortion reaches past a silhouette
        // into above-water content
        #ifdef WATER_REFRACTION
            vec3 refrSample = texture2D(uRefractionMap, refractionUV).rgb;
            vec3 refrUndistorted = texture2D(uRefractionMap, screenUV).rgb;
        #else
            vec3 refrSample = uShallowColor;
        #endif
        vec3 reflSample = uDeepColor;
        #ifdef WATER_REFLECTION_PLANAR
            reflSample = texture2D(uReflectionMap, reflectionUV).rgb;
        #endif
        #ifdef WATER_REFLECTION_SKY
            vec3 R = reflect(-V, N);
            R.y = abs(R.y); // no scene below the horizon, mirror the sky instead
            vec2 skyUv = toSphericalUv(R * vec3(-1.0, 1.0, 1.0));
            float level = clamp(uSkyBlur, 0.0, 4.0);
            float ilevel = floor(level);
            vec3 skyA = decodeRGBP(texture2D(texture_envAtlas, mapRoughnessUv(skyUv, ilevel)));
            vec3 skyB = decodeRGBP(texture2D(texture_envAtlas, mapRoughnessUv(skyUv, ilevel + 1.0)));
            reflSample = mix(skyA, skyB, level - ilevel);
        #endif

        // surface seen from below: blend the above-water world (refraction texture, visible in
        // the Snell window overhead) with total internal reflection of the underwater scene
        // (reflection texture), and fade to the underwater fog color with distance. Selected by
        // the camera side rather than per pixel, as at grazing angles the perturbed normal can
        // flip against the view direction, causing speckles
        if (uCameraBelow > 0.5) {
            float NdotUp = max(dot(-N, V), 0.0);
            float windowCenter = 1.0 - uSnellWindow;
            float window = smoothstep(windowCenter - 0.07, windowCenter + 0.07, NdotUp);
            vec3 col = mix(reflSample, refrSample, window);
            float dist = length(view_position - vWorldPos);
            col = mix(uUnderwaterFogColor, col, exp(-dist * uUnderwaterFogDensity));
            gl_FragColor = vec4(gammaCorrectOutput(col), 1.0);
            return;
        }

        // water depth (distance the view ray travels under water) based effects
        float waterDepth = 0.0;
        float absorb = 0.8;
        #ifdef WATER_DEPTH_EFFECTS
            vec2 depthUv = getGrabScreenPos(vScreenPos);
            float sceneDepth = getLinearScreenDepth(depthUv + N.xz * uDistortion);
            if (sceneDepth < vViewDepth) {
                // distorted sample is above the water surface, fall back to undistorted - both
                // for the depth and for the refraction color, so above-water content (or the sky
                // behind clipped geometry) does not leak into the shore line
                sceneDepth = getLinearScreenDepth(depthUv);
                #ifdef WATER_REFRACTION
                    refrSample = refrUndistorted;
                #endif
            }
            waterDepth = max(sceneDepth - vViewDepth, 0.0);
            absorb = 1.0 - exp(-waterDepth / uDepthFade);
        #endif

        // sun diffuse - modulates the water body color
        vec3 L = -uLightDir;
        vec3 sunDiffuse = mix(vec3(1.0), uLightColor * max(dot(N, L), 0.0), uDiffuseIntensity);
        vec3 shallowColor = uShallowColor * sunDiffuse;
        vec3 deepColor = uDeepColor * sunDiffuse;

        // base color of the water body - refracted scene absorbed with depth
        #ifdef WATER_REFRACTION
            vec3 base = mix(refrSample * shallowColor, deepColor, absorb);
        #else
            vec3 base = mix(shallowColor, deepColor, absorb);
        #endif

        // reflection
        vec3 refl = vec3(0.0);
        float hasReflection = 0.0;
        #if defined(WATER_REFLECTION_PLANAR) || defined(WATER_REFLECTION_SKY)
            refl = reflSample;
            hasReflection = 1.0;
        #endif

        // fresnel blend between the water body and the reflection
        float fresnel = mix(0.02, 1.0, pow(1.0 - NdotV, uFresnelPower));
        vec3 color = mix(base, refl, hasReflection * clamp(fresnel * uReflectionStrength, 0.0, 1.0));

        // sun specular
        vec3 H = normalize(L + V);
        color += uLightColor * pow(max(dot(N, H), 0.0), uSpecularPower) * uSpecularIntensity;

        // foam along the shoreline, lit by the directional light so it dims at night. The extra
        // light-luminance factor keeps the white foam from glowing against the dark night scene
        #if defined(WATER_FOAM) && defined(WATER_DEPTH_EFFECTS)
            float foamNoise = clamp(0.5 + 0.5 * (nm1.x + nm2.y), 0.0, 1.0);
            float foamMask = 1.0 - smoothstep(0.0, uFoamDepth, waterDepth);
            foamMask = smoothstep(0.3, 0.7, foamMask * (0.4 + 0.6 * foamNoise));
            // intensity follows the light luminance, but the foam keeps its own color (no orange
            // foam at sunrise)
            float lightLum = dot(uLightColor, vec3(0.299, 0.587, 0.114));
            float foamAtten = clamp(lightLum, 0.0, 1.0);
            vec3 foamLit = uFoamColor * (max(dot(N, L), 0.0) * lightLum * foamAtten * foamAtten * foamAtten);
            color = mix(color, foamLit, foamMask);
        #endif

        // opacity - fully opaque when refraction supplies the background
        #ifdef WATER_REFRACTION
            float alpha = 1.0;
        #else
            float alpha = mix(uOpacity, 1.0, clamp(fresnel, 0.0, 1.0));
        #endif

        // soft intersection with the geometry along the shoreline
        #ifdef WATER_DEPTH_EFFECTS
            alpha *= clamp(waterDepth / uShoreSoftness, 0.0, 1.0);
        #endif

        gl_FragColor = vec4(gammaCorrectOutput(color), alpha);
    }
`;

// ----------------------
// WGSL Shaders
// ----------------------

const vertexWGSL = /* wgsl */`
    #ifdef WATER_DEPTH_EFFECTS
        #include "screenDepthPS"
    #endif

    attribute vertex_position: vec3f;

    uniform matrix_model: mat4x4f;
    uniform matrix_viewProjection: mat4x4f;

    varying vWorldPos: vec3f;
    varying vScreenPos: vec4f;
    #ifdef WATER_WAVES
        varying vWavePos: vec2f;
    #endif
    #ifdef WATER_DEPTH_EFFECTS
        varying vViewDepth: f32;
    #endif

    ${waveFunctionsWGSL}

    @vertex
    fn vertexMain(input: VertexInput) -> VertexOutput {
        var output: VertexOutput;

        var worldPos: vec4f = uniform.matrix_model * vec4f(input.vertex_position, 1.0);

        #ifdef WATER_WAVES
            output.vWavePos = worldPos.xz;
            worldPos = vec4f(worldPos.xyz + waveDisplacement(worldPos.xz), 1.0);
        #endif

        output.vWorldPos = worldPos.xyz;

        let projPos: vec4f = uniform.matrix_viewProjection * worldPos;
        output.position = projPos;
        output.vScreenPos = projPos;

        #ifdef WATER_DEPTH_EFFECTS
            output.vViewDepth = getLinearDepth(worldPos.xyz);
        #endif

        return output;
    }
`;

const fragmentWGSL = /* wgsl */`
    #include "gammaPS"
    #ifdef WATER_DEPTH_EFFECTS
        #include "screenDepthPS"
    #endif
    #ifdef WATER_REFLECTION_SKY
        #include "decodePS"
        #include "envAtlasPS"
        #include "sphericalPS"
    #endif

    #ifndef SCREENSIZE
        #define SCREENSIZE
        uniform uScreenSize: vec4f;
    #endif

    var uNormalMap: texture_2d<f32>;
    var uNormalMapSampler: sampler;
    #ifdef WATER_REFLECTION_PLANAR
        var uReflectionMap: texture_2d<f32>;
        var uReflectionMapSampler: sampler;
    #endif
    #ifdef WATER_REFLECTION_SKY
        var texture_envAtlas: texture_2d<f32>;
        var texture_envAtlasSampler: sampler;
        uniform uSkyBlur: f32;
    #endif
    #ifdef WATER_REFRACTION
        var uRefractionMap: texture_2d<f32>;
        var uRefractionMapSampler: sampler;
    #endif

    uniform view_position: vec3f;
    #ifndef WATER_WAVES
        uniform uTime: f32;
    #endif

    uniform uShallowColor: vec3f;
    uniform uDeepColor: vec3f;
    uniform uLightDir: vec3f;
    uniform uLightColor: vec3f;
    uniform uRippleTiling: f32;
    uniform uRippleSpeed: f32;
    uniform uBumpiness: f32;
    uniform uDistortion: f32;
    uniform uFresnelPower: f32;
    uniform uReflectionStrength: f32;
    uniform uDepthFade: f32;
    uniform uShoreSoftness: f32;
    uniform uOpacity: f32;
    uniform uSpecularPower: f32;
    uniform uSpecularIntensity: f32;
    uniform uDiffuseIntensity: f32;
    uniform uUnderwaterFogDensity: f32;
    uniform uUnderwaterFogColor: vec3f;
    uniform uCameraBelow: f32;
    uniform uSnellWindow: f32;
    #ifdef WATER_FOAM
        uniform uFoamColor: vec3f;
        uniform uFoamDepth: f32;
    #endif

    varying vWorldPos: vec3f;
    varying vScreenPos: vec4f;
    #ifdef WATER_WAVES
        varying vWavePos: vec2f;
    #endif
    #ifdef WATER_DEPTH_EFFECTS
        varying vViewDepth: f32;
    #endif

    ${waveFunctionsWGSL}

    @fragment
    fn fragmentMain(input: FragmentInput) -> FragmentOutput {
        var output: FragmentOutput;

        // two layers of scrolling detail normals, in tangent space of a horizontal plane. The
        // second layer is rotated, so the tiling of the two never lines up into a visible grid.
        let baseUv: vec2f = input.vWorldPos.xz * uniform.uRippleTiling;
        let st: f32 = uniform.uTime * uniform.uRippleSpeed;
        let rotUv: vec2f = vec2f(0.79 * baseUv.x - 0.61 * baseUv.y, 0.61 * baseUv.x + 0.79 * baseUv.y);
        let nm1: vec3f = textureSample(uNormalMap, uNormalMapSampler, baseUv + vec2f(st, st * 0.7)).xyz * 2.0 - 1.0;
        let nm2: vec3f = textureSample(uNormalMap, uNormalMapSampler, rotUv * 1.73 + vec2f(-st * 0.8, st * 1.1)).xyz * 2.0 - 1.0;
        let detail: vec2f = (nm1.xy + nm2.xy) * 0.5 * uniform.uBumpiness;

        // combine with the geometry wave normal
        #ifdef WATER_WAVES
            let waveN: vec3f = waveNormal(input.vWavePos);
        #else
            let waveN: vec3f = vec3f(0.0, 1.0, 0.0);
        #endif
        let N: vec3f = normalize(vec3f(waveN.x + detail.x, waveN.y, waveN.z + detail.y));

        let V: vec3f = normalize(uniform.view_position - input.vWorldPos);
        let NdotV: f32 = max(dot(N, V), 0.0);

        // screen uv to sample the planar textures. The refraction camera matches the main camera,
        // so its texture is sampled without a flip; the reflection camera is mirrored by the
        // water plane, which flips the image vertically.
        let screenUV: vec2f = pcPosition.xy * uniform.uScreenSize.zw;
        let refractionUV: vec2f = screenUV + N.xz * uniform.uDistortion;
        let reflectionUV: vec2f = vec2f(screenUV.x, 1.0 - screenUV.y) + N.xz * uniform.uDistortion;

        // sample the planar / sky reflection textures up front, before any divergent flow
        // (WGSL uniformity). Both the distorted and undistorted refraction samples are taken -
        // the undistorted one is the fallback when the distortion reaches past a silhouette
        // into above-water content
        #ifdef WATER_REFRACTION
            var refrSample: vec3f = textureSample(uRefractionMap, uRefractionMapSampler, refractionUV).rgb;
            let refrUndistorted: vec3f = textureSample(uRefractionMap, uRefractionMapSampler, screenUV).rgb;
        #else
            let refrSample: vec3f = uniform.uShallowColor;
        #endif
        var reflSample: vec3f = uniform.uDeepColor;
        #ifdef WATER_REFLECTION_PLANAR
            reflSample = textureSample(uReflectionMap, uReflectionMapSampler, reflectionUV).rgb;
        #endif
        #ifdef WATER_REFLECTION_SKY
            var R: vec3f = reflect(-V, N);
            R.y = abs(R.y); // no scene below the horizon, mirror the sky instead
            let skyUv: vec2f = toSphericalUv(R * vec3f(-1.0, 1.0, 1.0));
            let level: f32 = clamp(uniform.uSkyBlur, 0.0, 4.0);
            let ilevel: f32 = floor(level);
            let skyA: vec3f = decodeRGBP(textureSample(texture_envAtlas, texture_envAtlasSampler, mapRoughnessUv(skyUv, ilevel)));
            let skyB: vec3f = decodeRGBP(textureSample(texture_envAtlas, texture_envAtlasSampler, mapRoughnessUv(skyUv, ilevel + 1.0)));
            reflSample = mix(skyA, skyB, level - ilevel);
        #endif

        // surface seen from below: blend the above-water world (refraction texture, visible in
        // the Snell window overhead) with total internal reflection of the underwater scene
        // (reflection texture), and fade to the underwater fog color with distance. Selected by
        // the camera side rather than per pixel, as at grazing angles the perturbed normal can
        // flip against the view direction, causing speckles
        if (uniform.uCameraBelow > 0.5) {
            let NdotUp: f32 = max(dot(-N, V), 0.0);
            let windowCenter: f32 = 1.0 - uniform.uSnellWindow;
            let window: f32 = smoothstep(windowCenter - 0.07, windowCenter + 0.07, NdotUp);
            var col: vec3f = mix(reflSample, refrSample, window);
            let dist: f32 = length(uniform.view_position - input.vWorldPos);
            col = mix(uniform.uUnderwaterFogColor, col, exp(-dist * uniform.uUnderwaterFogDensity));
            output.color = vec4f(gammaCorrectOutput(col), 1.0);
            return output;
        }

        // water depth (distance the view ray travels under water) based effects
        var waterDepth: f32 = 0.0;
        var absorb: f32 = 0.8;
        #ifdef WATER_DEPTH_EFFECTS
            let depthUv: vec2f = getGrabScreenPos(input.vScreenPos);
            var sceneDepth: f32 = getLinearScreenDepth(depthUv + N.xz * uniform.uDistortion);
            if (sceneDepth < input.vViewDepth) {
                // distorted sample is above the water surface, fall back to undistorted - both
                // for the depth and for the refraction color, so above-water content (or the sky
                // behind clipped geometry) does not leak into the shore line
                sceneDepth = getLinearScreenDepth(depthUv);
                #ifdef WATER_REFRACTION
                    refrSample = refrUndistorted;
                #endif
            }
            waterDepth = max(sceneDepth - input.vViewDepth, 0.0);
            absorb = 1.0 - exp(-waterDepth / uniform.uDepthFade);
        #endif

        // sun diffuse - modulates the water body color
        let L: vec3f = -uniform.uLightDir;
        let sunDiffuse: vec3f = mix(vec3f(1.0), uniform.uLightColor * max(dot(N, L), 0.0), uniform.uDiffuseIntensity);
        let shallowColor: vec3f = uniform.uShallowColor * sunDiffuse;
        let deepColor: vec3f = uniform.uDeepColor * sunDiffuse;

        // base color of the water body - refracted scene absorbed with depth
        #ifdef WATER_REFRACTION
            let base: vec3f = mix(refrSample * shallowColor, deepColor, absorb);
        #else
            let base: vec3f = mix(shallowColor, deepColor, absorb);
        #endif

        // reflection
        var refl: vec3f = vec3f(0.0);
        var hasReflection: f32 = 0.0;
        #if defined(WATER_REFLECTION_PLANAR) || defined(WATER_REFLECTION_SKY)
            refl = reflSample;
            hasReflection = 1.0;
        #endif

        // fresnel blend between the water body and the reflection
        let fresnel: f32 = mix(0.02, 1.0, pow(1.0 - NdotV, uniform.uFresnelPower));
        var color: vec3f = mix(base, refl, hasReflection * clamp(fresnel * uniform.uReflectionStrength, 0.0, 1.0));

        // sun specular
        let H: vec3f = normalize(L + V);
        color += uniform.uLightColor * pow(max(dot(N, H), 0.0), uniform.uSpecularPower) * uniform.uSpecularIntensity;

        // foam along the shoreline, lit by the directional light so it dims at night. The extra
        // light-luminance factor keeps the white foam from glowing against the dark night scene
        #if defined(WATER_FOAM) && defined(WATER_DEPTH_EFFECTS)
            let foamNoise: f32 = clamp(0.5 + 0.5 * (nm1.x + nm2.y), 0.0, 1.0);
            var foamMask: f32 = 1.0 - smoothstep(0.0, uniform.uFoamDepth, waterDepth);
            foamMask = smoothstep(0.3, 0.7, foamMask * (0.4 + 0.6 * foamNoise));
            // intensity follows the light luminance, but the foam keeps its own color (no orange
            // foam at sunrise)
            let lightLum: f32 = dot(uniform.uLightColor, vec3f(0.299, 0.587, 0.114));
            let foamAtten: f32 = clamp(lightLum, 0.0, 1.0);
            let foamLit: vec3f = uniform.uFoamColor * (max(dot(N, L), 0.0) * lightLum * foamAtten * foamAtten * foamAtten);
            color = mix(color, foamLit, foamMask);
        #endif

        // opacity - fully opaque when refraction supplies the background
        #ifdef WATER_REFRACTION
            var alpha: f32 = 1.0;
        #else
            var alpha: f32 = mix(uniform.uOpacity, 1.0, clamp(fresnel, 0.0, 1.0));
        #endif

        // soft intersection with the geometry along the shoreline
        #ifdef WATER_DEPTH_EFFECTS
            alpha *= clamp(waterDepth / uniform.uShoreSoftness, 0.0, 1.0);
        #endif

        output.color = vec4f(gammaCorrectOutput(color), alpha);
        return output;
    }
`;

// Note: material.setParameter stores arrays by reference, so each uniform needs its own array

/**
 * Water script renders a configurable water surface on the entity it is attached to. The entity
 * needs a render component with a plane type mesh (or a custom, roughly horizontal, plane-like
 * mesh - when geometry waves are used, the mesh needs to be tessellated). It supports:
 *
 * - Planar reflection of the scene, sky-dome only reflection, or no reflection.
 * - Planar refraction of the scene, or a simple transparency-based alternative.
 * - Optional oblique-clipping of the reflected / refracted scene by the water plane.
 * - Depth-based effects: color absorption, soft shorelines and foam. These require the scene
 *   depth map, and are enabled on the main camera automatically.
 * - Optional geometry waves (Gerstner), displacing the mesh vertices and lighting.
 * - Diffuse and specular lighting from a single directional light.
 *
 * The water entity should be placed on its own layer which is rendered after the skybox - the
 * internal reflection and refraction cameras render all layers of the main camera excluding
 * the water's own layers, the UI and the depth layer.
 *
 * @example
 * const water = new pc.Entity('Water');
 * water.addComponent('render', { type: 'plane', layers: [waterLayer.id], castShadows: false });
 * water.setLocalScale(100, 1, 100);
 * water.addComponent('script');
 * water.script.create(Water, {
 *     properties: {
 *         cameraEntity: camera,
 *         lightEntity: sun,
 *         normalMap: assets.normalMap.resource
 *     }
 * });
 * app.root.addChild(water);
 */
class Water extends Script {
    static scriptName = 'water';

    /**
     * The entity containing the main camera of the scene.
     *
     * @attribute
     * @type {Entity}
     */
    cameraEntity = null;

    /**
     * The entity with a directional light component, used for the diffuse and specular lighting
     * of the water. When not set, the water is not lit by the sun.
     *
     * @attribute
     * @type {Entity}
     */
    lightEntity = null;

    /**
     * The normal map used for the animated ripple detail of the surface. Two scrolling layers of
     * it are combined. When not set, a flat normal map is used.
     *
     * @type {Texture|null}
     */
    normalMap = null;

    /**
     * The greyscale pattern used for the underwater caustics. Two scrolling layers of it are
     * combined. When not set, the normal map is used as the pattern instead.
     *
     * @type {Texture|null}
     */
    causticsMap = null;

    /**
     * The source of the reflection: 'planar' renders the scene mirrored by the water plane,
     * 'sky' reflects the sky-dome (scene envAtlas) only, 'none' disables reflection.
     *
     * @attribute
     * @type {string}
     */
    reflectionSource = 'planar';

    /**
     * If set to true, the scene is rendered into a refraction texture, seen through the water,
     * distorted by the surface ripples. When disabled, simple alpha transparency is used instead,
     * which is cheaper.
     *
     * @attribute
     * @type {boolean}
     */
    refraction = true;

    /**
     * If set to true, the reflection / refraction cameras use an oblique projection to clip the
     * scene by the water plane, so no geometry from the wrong side of the surface leaks into the
     * textures.
     *
     * @attribute
     * @type {boolean}
     */
    obliqueClipping = true;

    /**
     * Distance the oblique clipping plane is shifted, allowing geometry slightly past the water
     * plane to be rendered. This hides artifacts along the waterline, especially with waves.
     *
     * @attribute
     * @range [0, 2]
     * @precision 2
     * @step 0.01
     */
    clipBias = 0.1;

    /**
     * Resolution of the reflection / refraction textures, relative to the main camera render
     * buffer resolution.
     *
     * @attribute
     * @range [0.05, 1]
     * @precision 2
     * @step 0.05
     */
    textureScale = 0.5;

    /**
     * If set to true, depth based effects are enabled: color absorption with depth, soft
     * shoreline intersections and foam. Requires the scene depth map, which is automatically
     * requested on the main camera.
     *
     * @attribute
     * @type {boolean}
     */
    depthEffects = true;

    /**
     * Color of the shallow water, tinting the refracted scene.
     *
     * @attribute
     */
    shallowColor = new Color(0.6, 0.9, 0.85);

    /**
     * Color of the deep water, which the water fades to with depth.
     *
     * @attribute
     */
    deepColor = new Color(0.03, 0.16, 0.24);

    /**
     * Distance in world units over which the water absorbs the light and fades to the deep color.
     *
     * @attribute
     * @range [0.1, 50]
     * @precision 1
     * @step 0.1
     */
    depthFade = 3;

    /**
     * Distance in world units over which the water fades out where it intersects geometry.
     *
     * @attribute
     * @range [0.01, 5]
     * @precision 2
     * @step 0.01
     */
    shoreSoftness = 0.3;

    /**
     * Opacity of the water, used only when refraction is disabled.
     *
     * @attribute
     * @range [0, 1]
     * @precision 2
     * @step 0.05
     */
    opacity = 0.8;

    /**
     * Tiling of the ripple normal map, in repeats per world unit.
     *
     * @attribute
     * @range [0.001, 2]
     * @precision 3
     * @step 0.01
     */
    rippleTiling = 0.1;

    /**
     * Scrolling speed of the ripple normal map layers.
     *
     * @attribute
     * @range [0, 1]
     * @precision 3
     * @step 0.005
     */
    rippleSpeed = 0.05;

    /**
     * Strength of the ripple normal map perturbation.
     *
     * @attribute
     * @range [0, 2]
     * @precision 2
     * @step 0.05
     */
    bumpiness = 0.5;

    /**
     * Amount the surface normal distorts the reflection and refraction.
     *
     * @attribute
     * @range [0, 0.2]
     * @precision 3
     * @step 0.005
     */
    distortion = 0.03;

    /**
     * Power of the fresnel term - how quickly the reflection fades out as the view angle
     * approaches the surface normal.
     *
     * @attribute
     * @range [0.5, 16]
     * @precision 1
     * @step 0.5
     */
    fresnelPower = 5;

    /**
     * Strength of the reflection.
     *
     * @attribute
     * @range [0, 2]
     * @precision 2
     * @step 0.05
     */
    reflectionStrength = 1;

    /**
     * Blurriness of the sky reflection (0 = sharp), used only when reflectionSource is 'sky'.
     *
     * @attribute
     * @range [0, 4]
     * @precision 1
     * @step 0.1
     */
    skyBlur = 0;

    /**
     * Power of the specular highlight of the directional light - higher values create a smaller,
     * sharper sun glint.
     *
     * @attribute
     * @range [8, 2048]
     * @precision 0
     * @step 8
     */
    specularPower = 256;

    /**
     * Intensity of the specular highlight of the directional light.
     *
     * @attribute
     * @range [0, 4]
     * @precision 2
     * @step 0.05
     */
    specularIntensity = 1;

    /**
     * How much the directional light diffusely lights the water body.
     *
     * @attribute
     * @range [0, 1]
     * @precision 2
     * @step 0.05
     */
    diffuseIntensity = 0.35;

    /**
     * If set to true, foam is rendered along the shoreline. Requires depthEffects.
     *
     * @attribute
     * @type {boolean}
     */
    foam = true;

    /**
     * Color of the shoreline foam.
     *
     * @attribute
     */
    foamColor = new Color(1, 1, 1);

    /**
     * Water depth in world units below which the shoreline foam shows.
     *
     * @attribute
     * @range [0.01, 5]
     * @precision 2
     * @step 0.01
     */
    foamDepth = 0.5;

    /**
     * Tiling of the caustics pattern, in repeats per world unit. The caustics render on other
     * materials in the scene which have the WATER_CAUSTICS define set, using the global shader
     * chunks and uniforms this script provides.
     *
     * @attribute
     * @range [0.01, 1]
     * @precision 3
     * @step 0.01
     */
    causticsTiling = 0.09;

    /**
     * Scrolling speed of the caustics pattern.
     *
     * @attribute
     * @range [0, 0.5]
     * @precision 3
     * @step 0.005
     */
    causticsSpeed = 0.04;

    /**
     * Brightness of the caustics.
     *
     * @attribute
     * @range [0, 4]
     * @precision 2
     * @step 0.05
     */
    causticsStrength = 1.5;

    /**
     * Water depth in world units over which the caustics fade out.
     *
     * @attribute
     * @range [0.1, 20]
     * @precision 1
     * @step 0.1
     */
    causticsDepth = 3;

    /**
     * Size of the Snell window - how much of the world above the surface is visible when looking
     * up from under the water, with the rest showing the reflection of the underwater scene.
     * The physically correct value is around 0.35.
     *
     * @attribute
     * @range [0.05, 0.95]
     * @precision 2
     * @step 0.05
     */
    snellWindow = 0.35;

    /**
     * If set to true, the water mesh is displaced by Gerstner waves, and the wave shape affects
     * the lighting. Requires a tessellated plane mesh for the displacement to be visible.
     *
     * @attribute
     * @type {boolean}
     */
    waves = false;

    /**
     * Amplitude of the main wave in world units.
     *
     * @attribute
     * @range [0, 5]
     * @precision 2
     * @step 0.01
     */
    waveAmplitude = 0.15;

    /**
     * Length of the main wave in world units.
     *
     * @attribute
     * @range [0.5, 100]
     * @precision 1
     * @step 0.5
     */
    waveLength = 8;

    /**
     * Speed multiplier of the wave animation.
     *
     * @attribute
     * @range [0, 5]
     * @precision 2
     * @step 0.05
     */
    waveSpeed = 1;

    /**
     * Steepness of the waves - how much the vertices are also displaced horizontally, creating
     * sharper crests.
     *
     * @attribute
     * @range [0, 1]
     * @precision 2
     * @step 0.05
     */
    waveSteepness = 0.4;

    /**
     * Direction the main wave travels, as an angle in degrees around the up axis.
     *
     * @attribute
     * @range [0, 360]
     * @precision 0
     * @step 1
     */
    waveDirection = 0;

    /**
     * Amplitude of the swell - a second band of longer, slower waves layered on top of the main
     * waves. In world units.
     *
     * @attribute
     * @range [0, 5]
     * @precision 2
     * @step 0.01
     */
    swellAmplitude = 0.25;

    /**
     * Length of the swell waves in world units.
     *
     * @attribute
     * @range [1, 200]
     * @precision 1
     * @step 0.5
     */
    swellLength = 35;

    /**
     * Speed multiplier of the swell animation.
     *
     * @attribute
     * @range [0, 5]
     * @precision 2
     * @step 0.05
     */
    swellSpeed = 1;

    /**
     * Direction the swell travels, as an angle in degrees around the up axis.
     *
     * @attribute
     * @range [0, 360]
     * @precision 0
     * @step 1
     */
    swellDirection = 40;

    /** @private */
    _material = null;

    /** @private */
    _originalMaterials = [];

    /** @private */
    _reflectionEntity = null;

    /** @private */
    _reflectionRenderer = null;

    /** @private */
    _refractionEntity = null;

    /** @private */
    _refractionRenderer = null;

    /** @private */
    _fallbackNormalMap = null;

    /** @private */
    _depthMapRequested = false;

    /** @private */
    _time = 0;

    // uniform value arrays, one per uniform as they are stored by reference
    /** @private */
    _shallowColorArray = [0, 0, 0];

    /** @private */
    _deepColorArray = [0, 0, 0];

    /** @private */
    _lightDirArray = [0, -1, 0];

    /** @private */
    _lightColorArray = [0, 0, 0];

    /** @private */
    _foamColorArray = [0, 0, 0];

    /** @private */
    _waveParamsArray = [0, 0, 0, 0];

    /** @private */
    _waveDirArray = [1, 0];

    /** @private */
    _swellParamsArray = [0, 0, 0, 0];

    /** @private */
    _swellDirArray = [1, 0];

    /** @private */
    _causticsParamsArray = [0, 0, 0, 0];

    /** @private */
    _underwaterFogColorArray = [0, 0, 0];

    initialize() {

        if (!this.cameraEntity?.camera) {
            console.error('Water script requires cameraEntity attribute to be set to an entity with a camera component.');
            return;
        }

        if (!this.entity.render) {
            console.error('Water script requires a render component on the same entity.');
            return;
        }

        // global chunk overrides for the height-gated fog and caustics on other materials
        setupWaterWorldChunks(this.app.graphicsDevice);

        // create the water material and apply it to the render component
        this._material = new ShaderMaterial({
            uniqueName: 'WaterMaterial',
            vertexGLSL: vertexGLSL,
            fragmentGLSL: fragmentGLSL,
            vertexWGSL: vertexWGSL,
            fragmentWGSL: fragmentWGSL,
            attributes: {
                vertex_position: SEMANTIC_POSITION
            }
        });
        this._material.blendType = BLEND_NORMAL;
        this._material.depthWrite = false;
        // visible from below the surface as well
        this._material.cull = CULLFACE_NONE;

        const meshInstances = this.entity.render.meshInstances;
        this._originalMaterials = meshInstances.map(mi => mi.material);
        meshInstances.forEach((mi) => {
            mi.material = this._material;
        });

        // flat normal map used when none is provided
        this._fallbackNormalMap = new Texture(this.app.graphicsDevice, {
            name: 'waterFlatNormalMap',
            width: 1,
            height: 1,
            format: PIXELFORMAT_RGBA8
        });
        this._fallbackNormalMap.lock().set([128, 128, 255, 255]);
        this._fallbackNormalMap.unlock();

        // update the rendering state after all script updates, when the main camera is final
        const evtUpdate = this.app.on('update', dt => this._frameUpdate(dt));

        this.on('disable', () => {
            this._enableCameras(false);
            this._requestDepthMap(false);
        });

        this.on('destroy', () => {
            evtUpdate.off();
            this._requestDepthMap(false);

            const render = this.entity.render;
            if (render) {
                render.meshInstances.forEach((mi, i) => {
                    mi.material = this._originalMaterials[i] ?? mi.material;
                });
            }
            this._originalMaterials = [];

            this._reflectionEntity?.destroy();
            this._reflectionEntity = null;
            this._refractionEntity?.destroy();
            this._refractionEntity = null;

            this._material.destroy();
            this._material = null;
            this._fallbackNormalMap.destroy();
            this._fallbackNormalMap = null;
        });
    }

    /**
     * Layers the internal cameras render - all layers of the main camera, excluding the water's
     * own layers, the UI and the depth layer.
     *
     * @returns {number[]} The layer ids.
     * @private
     */
    _getPlanarCameraLayers() {
        const waterLayers = this.entity.render?.layers ?? [];
        return this.cameraEntity.camera.layers.filter((id) => {
            return !waterLayers.includes(id) && id !== LAYERID_UI && id !== LAYERID_DEPTH;
        });
    }

    /**
     * Creates an internal camera entity with a PlanarRenderer script.
     *
     * @param {string} name - Name of the entity.
     * @param {string} mode - Mode of the PlanarRenderer.
     * @returns {{entity: Entity, renderer: PlanarRenderer}} The created entity and script.
     * @private
     */
    _createPlanarCamera(name, mode) {
        const mainCamera = this.cameraEntity.camera;

        const entity = new Entity(`${this.entity.name}:${name}`);
        entity.addComponent('camera', {
            layers: this._getPlanarCameraLayers(),
            priority: mainCamera.priority - 1,
            toneMapping: mainCamera.toneMapping,
            fog: mainCamera.fog
        });
        entity.addComponent('script');
        const renderer = entity.script.create(PlanarRenderer, {
            properties: {
                sceneCameraEntity: this.cameraEntity,
                mode: mode,
                scale: this.textureScale,
                mipmaps: false,
                depth: true
            }
        });
        this.app.root.addChild(entity);
        return { entity, renderer };
    }

    /**
     * Enables or disables the internal cameras.
     *
     * @param {boolean} value - The new state.
     * @private
     */
    _enableCameras(value) {
        if (this._reflectionEntity) this._reflectionEntity.enabled = value;
        if (this._refractionEntity) this._refractionEntity.enabled = value;
    }

    /**
     * Requests or releases the scene depth map on the main camera.
     *
     * @param {boolean} value - The new state.
     * @private
     */
    _requestDepthMap(value) {
        if (this._depthMapRequested !== value) {
            this._depthMapRequested = value;
            this.cameraEntity?.camera?.requestSceneDepthMap(value);
        }
    }

    /**
     * Sets a define on the water material, and returns true when its value changed.
     *
     * @param {string} name - The define name.
     * @param {boolean} value - The define value.
     * @returns {boolean} True when the value changed.
     * @private
     */
    _setDefine(name, value) {
        const changed = this._material.defines.has(name) !== value;
        this._material.setDefine(name, value);
        return changed;
    }

    _frameUpdate(dt) {

        if (!this._material || !this.cameraEntity?.camera) {
            return;
        }

        this._time += dt;

        const material = this._material;
        const skyReflection = this.reflectionSource === 'sky' && !!this.app.scene.envAtlas;
        const planarReflection = this.reflectionSource === 'planar';

        // sync shader variant defines
        let definesChanged = false;
        definesChanged = this._setDefine('WATER_REFLECTION_PLANAR', planarReflection) || definesChanged;
        definesChanged = this._setDefine('WATER_REFLECTION_SKY', skyReflection) || definesChanged;
        definesChanged = this._setDefine('WATER_REFRACTION', this.refraction) || definesChanged;
        definesChanged = this._setDefine('WATER_DEPTH_EFFECTS', this.depthEffects) || definesChanged;
        definesChanged = this._setDefine('WATER_FOAM', this.foam && this.depthEffects) || definesChanged;
        definesChanged = this._setDefine('WATER_WAVES', this.waves) || definesChanged;
        if (definesChanged) {
            material.update();
        }

        // scene depth map for the depth based effects
        this._requestDepthMap(this.depthEffects);

        // the water plane, defined by the entity transform
        const planePoint = this.entity.getPosition();
        const planeNormal = this.entity.up;

        // when the main camera is under the water, hand the internal cameras a flipped plane:
        // the mirrored camera then captures the underwater scene (what total internal reflection
        // shows), and the clipped refraction camera captures the world above the surface
        const camPos = this.cameraEntity.getPosition();
        const submerged = planeNormal.dot(camPos) < planeNormal.dot(planePoint);
        const clipNormal = submerged ? _flippedNormal.copy(planeNormal).mulScalar(-1) : planeNormal;

        // planar reflection
        if (planarReflection) {
            if (!this._reflectionEntity) {
                ({ entity: this._reflectionEntity, renderer: this._reflectionRenderer } = this._createPlanarCamera('WaterReflection', 'reflection'));
            }
            this._reflectionEntity.enabled = true;
            this._reflectionEntity.camera.toneMapping = this.cameraEntity.camera.toneMapping;
            this._updatePlanarRenderer(this._reflectionRenderer, planePoint, clipNormal);
            const texture = this._reflectionRenderer.frameUpdate();
            if (texture) {
                material.setParameter('uReflectionMap', texture);
            }
        } else if (this._reflectionEntity) {
            this._reflectionEntity.enabled = false;
        }

        // planar refraction
        if (this.refraction) {
            if (!this._refractionEntity) {
                ({ entity: this._refractionEntity, renderer: this._refractionRenderer } = this._createPlanarCamera('WaterRefraction', 'refraction'));
            }
            this._refractionEntity.enabled = true;
            this._refractionEntity.camera.toneMapping = this.cameraEntity.camera.toneMapping;
            this._updatePlanarRenderer(this._refractionRenderer, planePoint, clipNormal);
            const texture = this._refractionRenderer.frameUpdate();
            if (texture) {
                material.setParameter('uRefractionMap', texture);
            }
        } else if (this._refractionEntity) {
            this._refractionEntity.enabled = false;
        }

        // sky reflection
        if (skyReflection) {
            material.setParameter('texture_envAtlas', this.app.scene.envAtlas);
            material.setParameter('uSkyBlur', this.skyBlur);
        }

        this._updateUniforms();

        // global uniforms for the height-gated fog and caustics chunks on other materials
        const scope = this.app.graphicsDevice.scope;
        const waterLevel = planeNormal.dot(planePoint);
        scope.resolve('waterLevel').setValue(waterLevel);

        // when the camera is under the water, raise the fog gate above the waterline, so wave
        // troughs and the geometry just under the surface are fogged as well
        const waveMargin = this.waves ? this.waveAmplitude * 2 + this.swellAmplitude * 1.7 : 0;
        scope.resolve('waterFogLevel').setValue(waterLevel + (submerged ? waveMargin + 0.5 : 0));
        scope.resolve('waterTime').setValue(this._time);
        scope.resolve('waterCausticsMap').setValue(this.causticsMap ?? this.normalMap ?? this._fallbackNormalMap);
        material.setParameter('uCameraBelow', submerged ? 1 : 0);
        this._causticsParamsArray[0] = this.causticsTiling;
        this._causticsParamsArray[1] = this.causticsSpeed;
        this._causticsParamsArray[2] = this.causticsStrength;
        this._causticsParamsArray[3] = this.causticsDepth;
        scope.resolve('waterCausticsParams').setValue(this._causticsParamsArray);
        scope.resolve('waterCausticsColor').setValue(this._lightColorArray);
    }

    /**
     * Updates the properties of an internal PlanarRenderer script.
     *
     * @param {PlanarRenderer} renderer - The script to update.
     * @param {import('playcanvas').Vec3} planePoint - A point on the water plane.
     * @param {import('playcanvas').Vec3} planeNormal - The water plane normal.
     * @private
     */
    _updatePlanarRenderer(renderer, planePoint, planeNormal) {
        renderer.planePoint.copy(planePoint);
        renderer.planeNormal.copy(planeNormal);
        renderer.scale = this.textureScale;
        renderer.obliqueClipping = this.obliqueClipping;
        renderer.clipBias = this.clipBias;
    }

    /**
     * Converts a color to a linear space array.
     *
     * @param {Color} color - The color to convert.
     * @param {number[]} target - The array to write the result to.
     * @param {number} [intensity] - Optional intensity multiplier.
     * @returns {number[]} The target array.
     * @private
     */
    _linearColor(color, target, intensity = 1) {
        target[0] = Math.pow(color.r, 2.2) * intensity;
        target[1] = Math.pow(color.g, 2.2) * intensity;
        target[2] = Math.pow(color.b, 2.2) * intensity;
        return target;
    }

    /** @private */
    _updateUniforms() {
        const material = this._material;

        material.setParameter('uNormalMap', this.normalMap ?? this._fallbackNormalMap);
        material.setParameter('uTime', this._time);

        material.setParameter('uShallowColor', this._linearColor(this.shallowColor, this._shallowColorArray));
        material.setParameter('uDeepColor', this._linearColor(this.deepColor, this._deepColorArray));
        material.setParameter('uRippleTiling', this.rippleTiling);
        material.setParameter('uRippleSpeed', this.rippleSpeed);
        material.setParameter('uBumpiness', this.bumpiness);
        material.setParameter('uDistortion', this.distortion);
        material.setParameter('uFresnelPower', this.fresnelPower);
        material.setParameter('uReflectionStrength', this.reflectionStrength);
        material.setParameter('uDepthFade', this.depthFade);
        material.setParameter('uShoreSoftness', this.shoreSoftness);
        material.setParameter('uOpacity', this.opacity);
        material.setParameter('uSpecularPower', this.specularPower);

        // distance fog applied to the surface when seen from under the water - follows the scene
        // fog when enabled
        const fog = this.app.scene.fog;
        material.setParameter('uUnderwaterFogDensity', fog.type !== FOG_NONE ? fog.density : 0.06);
        const fogColor = fog.type !== FOG_NONE ? fog.color : this.deepColor;
        material.setParameter('uUnderwaterFogColor', this._linearColor(fogColor, this._underwaterFogColorArray));
        material.setParameter('uSnellWindow', this.snellWindow);

        // directional light. Note: directional lights emit along the entity's negative Y axis,
        // so the light travel direction is the negated up vector of the entity.
        const light = this.lightEntity?.light;
        if (light) {
            const dir = this.lightEntity.up;
            this._lightDirArray[0] = -dir.x;
            this._lightDirArray[1] = -dir.y;
            this._lightDirArray[2] = -dir.z;
            this._linearColor(light.color, this._lightColorArray, light.intensity);
            material.setParameter('uSpecularIntensity', this.specularIntensity);
            material.setParameter('uDiffuseIntensity', this.diffuseIntensity);
        } else {
            this._lightDirArray[0] = 0;
            this._lightDirArray[1] = -1;
            this._lightDirArray[2] = 0;
            this._lightColorArray[0] = this._lightColorArray[1] = this._lightColorArray[2] = 0;
            material.setParameter('uSpecularIntensity', 0);
            material.setParameter('uDiffuseIntensity', 0);
        }
        material.setParameter('uLightDir', this._lightDirArray);
        material.setParameter('uLightColor', this._lightColorArray);

        if (this.foam && this.depthEffects) {
            material.setParameter('uFoamColor', this._linearColor(this.foamColor, this._foamColorArray));
            material.setParameter('uFoamDepth', this.foamDepth);
        }

        if (this.waves) {
            this._waveParamsArray[0] = this.waveAmplitude;
            this._waveParamsArray[1] = (2 * Math.PI) / Math.max(this.waveLength, 0.01);
            this._waveParamsArray[2] = this.waveSpeed;
            this._waveParamsArray[3] = this.waveSteepness;
            material.setParameter('uWaveParams', this._waveParamsArray);

            const angle = (this.waveDirection * Math.PI) / 180;
            this._waveDirArray[0] = Math.cos(angle);
            this._waveDirArray[1] = Math.sin(angle);
            material.setParameter('uWaveDir', this._waveDirArray);

            this._swellParamsArray[0] = this.swellAmplitude;
            this._swellParamsArray[1] = (2 * Math.PI) / Math.max(this.swellLength, 0.01);
            this._swellParamsArray[2] = this.swellSpeed;
            this._swellParamsArray[3] = this.waveSteepness;
            material.setParameter('uSwellParams', this._swellParamsArray);

            const swellAngle = (this.swellDirection * Math.PI) / 180;
            this._swellDirArray[0] = Math.cos(swellAngle);
            this._swellDirArray[1] = Math.sin(swellAngle);
            material.setParameter('uSwellDir', this._swellDirArray);
        }
    }
}

export { Water };
