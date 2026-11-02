// Aerial perspective for the Splash One demo.
//
// The distance haze is colored by the sky itself rather than by one flat fog color. Every fogged pixel
// evaluates the sky of the DynamicSkyEffect, in the direction it is seen from, so a hill on the horizon
// fades into exactly the sky behind it - warm towards a low sun, blue away from it - and after sunset
// into the sky's night gradient and twilight afterglow. The chunks include the effect's own model of
// the sky, dynamicSkyAtmospherePS, which reads the uniforms the effect sets on the device.
//
// The density thins out exponentially with altitude, integrated along the view ray, so the valleys stay
// hazy while the view from high up is clear, and climbing through the haze layer reads as climbing.

import { SHADERLANGUAGE_GLSL, SHADERLANGUAGE_WGSL } from 'playcanvas';

/**
 * @import { Material, StandardMaterial } from 'playcanvas'
 */

// the sky, without its sun disc, stars and moon - the haze in front of a hill should glow around the
// sun, but never show a second sun printed on the ground
const skyGLSL = /* glsl */ `
    #include "dynamicSkyAtmospherePS"
    uniform mat3 dynSkyRotation;

    // x: density at sea level, y: one over the scale height, z: the most the haze can hide, w: brightness
    uniform vec4 atmosphere_params;

    vec3 atmosphereSky(vec3 worldDir) {
        // in the space of the sky - turned by its rotation and mirrored on x - and kept just above the
        // horizon when looking down, where the daylight model has no answer
        vec3 dir = worldDir * dynSkyRotation;
        dir = normalize(vec3(-dir.x, max(dir.y, 0.015), dir.z));
        vec3 ambient;
        return dynamicSkyBase(dir, ambient) * atmosphere_params.w;
    }

    // how much of a surface at the given position is hidden by haze, seen from the camera
    float atmosphereAmount(vec3 cameraPos, vec3 worldPos) {
        float dist = distance(worldPos, cameraPos);
        float b = atmosphere_params.y;
        float h0 = cameraPos.y;
        float dh = worldPos.y - h0;

        // the density integrated along the ray, which falls off exponentially with height
        float optical = abs(dh) < 1.0 ?
            exp(-b * h0) * dist :
            dist * (exp(-b * h0) - exp(-b * worldPos.y)) / (b * dh);

        return min(1.0 - exp(-atmosphere_params.x * optical), atmosphere_params.z);
    }

    vec3 atmosphereApply(vec3 color, vec3 cameraPos, vec3 worldPos, float premultiply) {
        vec3 dir = normalize(worldPos - cameraPos);
        float amount = atmosphereAmount(cameraPos, worldPos);
        return mix(color, atmosphereSky(dir) * premultiply, amount);
    }
`;

const skyWGSL = /* wgsl */ `
    #include "dynamicSkyAtmospherePS"
    uniform dynSkyRotation: mat3x3f;

    // x: density at sea level, y: one over the scale height, z: the most the haze can hide, w: brightness
    uniform atmosphere_params: vec4f;

    fn atmosphereSky(worldDir: vec3f) -> vec3f {
        // in the space of the sky - turned by its rotation and mirrored on x - and kept just above the
        // horizon when looking down, where the daylight model has no answer
        let turned = worldDir * uniform.dynSkyRotation;
        let dir = normalize(vec3f(-turned.x, max(turned.y, 0.015), turned.z));
        var ambient: vec3f;
        return dynamicSkyBase(dir, &ambient) * uniform.atmosphere_params.w;
    }

    // how much of a surface at the given position is hidden by haze, seen from the camera
    fn atmosphereAmount(cameraPos: vec3f, worldPos: vec3f) -> f32 {
        let dist = distance(worldPos, cameraPos);
        let b = uniform.atmosphere_params.y;
        let h0 = cameraPos.y;
        let dh = worldPos.y - h0;

        // the density integrated along the ray, which falls off exponentially with height
        var optical = exp(-b * h0) * dist;
        if (abs(dh) >= 1.0) {
            optical = dist * (exp(-b * h0) - exp(-b * worldPos.y)) / (b * dh);
        }

        return min(1.0 - exp(-uniform.atmosphere_params.x * optical), uniform.atmosphere_params.z);
    }

    fn atmosphereApply(color: vec3f, cameraPos: vec3f, worldPos: vec3f, premultiply: f32) -> vec3f {
        let dir = normalize(worldPos - cameraPos);
        let amount = atmosphereAmount(cameraPos, worldPos);
        return mix(color, atmosphereSky(dir) * premultiply, vec3f(amount));
    }
`;

/**
 * The atmosphere functions, for custom shaders to include. They provide `atmosphereApply`, which
 * hazes a linear color by the distance and height of the surface it belongs to.
 */
export const atmosphereChunks = {
    glsl: skyGLSL,
    wgsl: skyWGSL
};

// A replacement for the engine's fog chunk on the lit materials. It keeps the interface the lit shader
// expects - the blend mode factor and addFog - and swaps the flat fog color for the sky colored haze.
// The scene's own fog stays off, which is what keeps every other shader in the frame unaffected.
const fogGLSL = /* glsl */ `
    float dBlendModeFogFactor = 1.0;

    ${skyGLSL}

    vec3 addFog(vec3 color) {
        return atmosphereApply(color, view_position, vPositionW, dBlendModeFogFactor);
    }
`;

const fogWGSL = /* wgsl */ `
    var<private> dBlendModeFogFactor : f32 = 1.0;

    ${skyWGSL}

    fn addFog(color: vec3f) -> vec3f {
        return atmosphereApply(color, uniform.view_position, vPositionW, dBlendModeFogFactor);
    }
`;

/**
 * Puts a lit material inside the atmosphere, so that it hazes with distance like the terrain does.
 *
 * @param {StandardMaterial|Material} material - The material to modify. Call update on it afterwards.
 */
export const applyAtmosphere = (material) => {
    material.shaderChunksVersion = '2.8';
    material.getShaderChunks(SHADERLANGUAGE_GLSL).set('fogPS', fogGLSL);
    material.getShaderChunks(SHADERLANGUAGE_WGSL).set('fogPS', fogWGSL);
};
