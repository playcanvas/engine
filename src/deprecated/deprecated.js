// This module must stay free of module-scope side effects: everything here is a plain alias or a
// deprecated helper function, so bundlers can drop it entirely when unused (package.json declares
// "sideEffects": false). Prototype-patch shims live at the bottom of the module that defines the
// class they patch, so they only ship when that class does.
//
// Tag each deprecated export with `@deprecated` and `@ignore`: the API reference hides it either
// way, but editors and the published typings only mark it as deprecated when it is tagged.

import { Debug } from '../core/debug.js';

import { Vec4 } from '../core/math/vec4.js';

import {
    BLENDMODE_CONSTANT, BLENDMODE_ONE_MINUS_CONSTANT,
    PIXELFORMAT_LA8, PIXELFORMAT_RGB565, PIXELFORMAT_RGBA5551, PIXELFORMAT_RGBA4, PIXELFORMAT_RGB8, PIXELFORMAT_RGBA8,
    PIXELFORMAT_SRGB8, PIXELFORMAT_SRGBA8, PIXELFORMAT_RG11B10F,
    SHADERLANGUAGE_GLSL
} from '../platform/graphics/constants.js';
import { drawQuadWithShader } from '../scene/graphics/quad-render-utils.js';

import { AnimationKey, AnimationNode } from '../scene/animation/animation.js';
import { Geometry } from '../scene/geometry/geometry.js';
import { CylinderGeometry } from '../scene/geometry/cylinder-geometry.js';
import { BoxGeometry } from '../scene/geometry/box-geometry.js';
import { CapsuleGeometry } from '../scene/geometry/capsule-geometry.js';
import { ConeGeometry } from '../scene/geometry/cone-geometry.js';
import { PlaneGeometry } from '../scene/geometry/plane-geometry.js';
import { SphereGeometry } from '../scene/geometry/sphere-geometry.js';
import { TorusGeometry } from '../scene/geometry/torus-geometry.js';
import { Mesh } from '../scene/mesh.js';
import { LitShaderOptions } from '../scene/shader-lib/programs/lit-shader-options.js';
import { ShaderChunks } from '../scene/shader-lib/shader-chunks.js';

import { getApplication } from '../framework/globals.js';
import {
    BODYTYPE_DYNAMIC, BODYTYPE_KINEMATIC, BODYTYPE_STATIC
} from '../framework/components/rigid-body/constants.js';
import {
    ACTIVE_TAG, CF_KINEMATIC_OBJECT, CF_NO_CONTACT_RESPONSE, CF_STATIC_OBJECT, DISABLE_DEACTIVATION,
    DISABLE_SIMULATION, ISLAND_SLEEPING, WANTS_DEACTIVATION
} from '../framework/physics/ammo/constants.js';

// GRAPHICS

/**
 * @deprecated Use PIXELFORMAT_LA8 instead.
 * @ignore
 */
export const PIXELFORMAT_L8_A8 = PIXELFORMAT_LA8;

/**
 * @deprecated Use PIXELFORMAT_RGB565 instead.
 * @ignore
 */
export const PIXELFORMAT_R5_G6_B5 = PIXELFORMAT_RGB565;

/**
 * @deprecated Use PIXELFORMAT_RGBA5551 instead.
 * @ignore
 */
export const PIXELFORMAT_R5_G5_B5_A1 = PIXELFORMAT_RGBA5551;

/**
 * @deprecated Use PIXELFORMAT_RGBA4 instead.
 * @ignore
 */
export const PIXELFORMAT_R4_G4_B4_A4 = PIXELFORMAT_RGBA4;

/**
 * @deprecated Use PIXELFORMAT_RGB8 instead.
 * @ignore
 */
export const PIXELFORMAT_R8_G8_B8 = PIXELFORMAT_RGB8;

/**
 * @deprecated Use PIXELFORMAT_RGBA8 instead.
 * @ignore
 */
export const PIXELFORMAT_R8_G8_B8_A8 = PIXELFORMAT_RGBA8;

/**
 * @deprecated Use PIXELFORMAT_SRGB8 instead.
 * @ignore
 */
export const PIXELFORMAT_SRGB = PIXELFORMAT_SRGB8;

/**
 * @deprecated Use PIXELFORMAT_SRGBA8 instead.
 * @ignore
 */
export const PIXELFORMAT_SRGBA = PIXELFORMAT_SRGBA8;

/**
 * @deprecated Use PIXELFORMAT_RG11B10F instead.
 * @ignore
 */
export const PIXELFORMAT_111110F = PIXELFORMAT_RG11B10F;

/**
 * @deprecated Use BLENDMODE_CONSTANT instead.
 * @ignore
 */
export const BLENDMODE_CONSTANT_COLOR = BLENDMODE_CONSTANT;

/**
 * @deprecated Use BLENDMODE_ONE_MINUS_CONSTANT instead.
 * @ignore
 */
export const BLENDMODE_ONE_MINUS_CONSTANT_COLOR = BLENDMODE_ONE_MINUS_CONSTANT;

/**
 * @deprecated Use BLENDMODE_CONSTANT instead.
 * @ignore
 */
export const BLENDMODE_CONSTANT_ALPHA = BLENDMODE_CONSTANT;

/**
 * @deprecated Use BLENDMODE_ONE_MINUS_CONSTANT instead.
 * @ignore
 */
export const BLENDMODE_ONE_MINUS_CONSTANT_ALPHA = BLENDMODE_ONE_MINUS_CONSTANT;

/**
 * @deprecated Set ShaderChunks#version to a version string such as '2.8' instead.
 * @ignore
 */
export const CHUNKAPI_1_51 = '1.51';

/**
 * @deprecated Set ShaderChunks#version to a version string such as '2.8' instead.
 * @ignore
 */
export const CHUNKAPI_1_55 = '1.55';

/**
 * @deprecated Set ShaderChunks#version to a version string such as '2.8' instead.
 * @ignore
 */
export const CHUNKAPI_1_56 = '1.56';

/**
 * @deprecated Set ShaderChunks#version to a version string such as '2.8' instead.
 * @ignore
 */
export const CHUNKAPI_1_57 = '1.57';

/**
 * @deprecated Set ShaderChunks#version to a version string such as '2.8' instead.
 * @ignore
 */
export const CHUNKAPI_1_58 = '1.58';

/**
 * @deprecated Set ShaderChunks#version to a version string such as '2.8' instead.
 * @ignore
 */
export const CHUNKAPI_1_60 = '1.60';

/**
 * @deprecated Set ShaderChunks#version to a version string such as '2.8' instead.
 * @ignore
 */
export const CHUNKAPI_1_62 = '1.62';

/**
 * @deprecated Set ShaderChunks#version to a version string such as '2.8' instead.
 * @ignore
 */
export const CHUNKAPI_1_65 = '1.65';

/**
 * @deprecated Set ShaderChunks#version to a version string such as '2.8' instead.
 * @ignore
 */
export const CHUNKAPI_1_70 = '1.70';

/**
 * @deprecated Set ShaderChunks#version to a version string such as '2.8' instead.
 * @ignore
 */
export const CHUNKAPI_2_1 = '2.1';

/**
 * @deprecated Set ShaderChunks#version to a version string such as '2.8' instead.
 * @ignore
 */
export const CHUNKAPI_2_3 = '2.3';

/**
 * @deprecated Set ShaderChunks#version to a version string such as '2.8' instead.
 * @ignore
 */
export const CHUNKAPI_2_5 = '2.5';

/**
 * @deprecated Set ShaderChunks#version to a version string such as '2.8' instead.
 * @ignore
 */
export const CHUNKAPI_2_6 = '2.6';

/**
 * @deprecated Set ShaderChunks#version to a version string such as '2.8' instead.
 * @ignore
 */
export const CHUNKAPI_2_7 = '2.7';

/**
 * @deprecated Set ShaderChunks#version to a version string such as '2.8' instead.
 * @ignore
 */
export const CHUNKAPI_2_8 = '2.8';

const _viewport = new Vec4();

/**
 * @deprecated Use `Mesh.fromGeometry(device, new SphereGeometry(options))` instead.
 * @ignore
 */
export function createSphere(device, opts) {
    Debug.deprecated('createSphere is deprecated. Use \'Mesh.fromGeometry(device, new SphereGeometry(options));\' format instead.');
    return Mesh.fromGeometry(device, new SphereGeometry(opts));
}

/**
 * @deprecated Use `Mesh.fromGeometry(device, new PlaneGeometry(options))` instead.
 * @ignore
 */
export function createPlane(device, opts) {
    Debug.deprecated('createPlane is deprecated. Use \'Mesh.fromGeometry(device, new PlaneGeometry(options));\' format instead.');
    return Mesh.fromGeometry(device, new PlaneGeometry(opts));
}

/**
 * @deprecated Use `Mesh.fromGeometry(device, new BoxGeometry(options))` instead.
 * @ignore
 */
export function createBox(device, opts) {
    Debug.deprecated('createBox is deprecated. Use \'Mesh.fromGeometry(device, new BoxGeometry(options));\' format instead.');
    return Mesh.fromGeometry(device, new BoxGeometry(opts));
}

/**
 * @deprecated Use `Mesh.fromGeometry(device, new TorusGeometry(options))` instead.
 * @ignore
 */
export function createTorus(device, opts) {
    Debug.deprecated('createTorus is deprecated. Use \'Mesh.fromGeometry(device, new TorusGeometry(options));\' format instead.');
    return Mesh.fromGeometry(device, new TorusGeometry(opts));
}

/**
 * @deprecated Use `Mesh.fromGeometry(device, new CapsuleGeometry(options))` instead.
 * @ignore
 */
export function createCapsule(device, opts) {
    Debug.deprecated('createCapsule is deprecated. Use \'Mesh.fromGeometry(device, new CapsuleGeometry(options));\' format instead.');
    return Mesh.fromGeometry(device, new CapsuleGeometry(opts));
}

/**
 * @deprecated Use `Mesh.fromGeometry(device, new ConeGeometry(options))` instead.
 * @ignore
 */
export function createCone(device, opts) {
    Debug.deprecated('createCone is deprecated. Use \'Mesh.fromGeometry(device, new ConeGeometry(options));\' format instead.');
    return Mesh.fromGeometry(device, new ConeGeometry(opts));
}

/**
 * @deprecated Use `Mesh.fromGeometry(device, new CylinderGeometry(options))` instead.
 * @ignore
 */
export function createCylinder(device, opts) {
    Debug.deprecated('createCylinder is deprecated. Use \'Mesh.fromGeometry(device, new CylinderGeometry(options));\' format instead.');
    return Mesh.fromGeometry(device, new CylinderGeometry(opts));
}

/**
 * @deprecated Use `Mesh.fromGeometry(device, new Geometry())` instead.
 * @ignore
 */
export function createMesh(device, positions, opts = {}) {
    Debug.deprecated('createMesh is deprecated. Use \'Mesh.fromGeometry(device, new Geometry());\' format instead.');

    const geom = new Geometry();
    geom.positions = positions;
    geom.normals = opts.normals;
    geom.tangents = opts.tangents;
    geom.colors = opts.colors;
    geom.uvs = opts.uvs;
    geom.uvs1 = opts.uvs1;
    geom.blendIndices = opts.blendIndices;
    geom.blendWeights = opts.blendWeights;
    geom.indices = opts.indices;

    return Mesh.fromGeometry(device, geom, opts);
}

/**
 * @deprecated Use drawQuadWithShader instead.
 * @ignore
 */
export function drawFullscreenQuad(device, target, vertexBuffer, shader, rect) {

    Debug.deprecated('drawFullscreenQuad is deprecated. When used as part of PostEffect, use PostEffect#drawQuad instead.');

    // convert rect in normalized space to viewport in pixel space
    let viewport;
    if (rect) {
        const w = target ? target.width : device.width;
        const h = target ? target.height : device.height;
        viewport = _viewport.set(rect.x * w, rect.y * h, rect.z * w, rect.w * h);
    }

    drawQuadWithShader(device, target, shader, viewport, undefined, shader.name);
}

// SCENE

/**
 * @deprecated Use AnimationKey instead.
 * @ignore
 */
export const Key = AnimationKey;

/**
 * @deprecated Use AnimationNode instead.
 * @ignore
 */
export const Node = AnimationNode;

/**
 * @deprecated Use LitShaderOptions instead.
 * @ignore
 */
export const LitOptions = LitShaderOptions;

/**
 * @deprecated Use ShaderChunks.get to access the global shader chunks instead.
 * @ignore
 */
export const shaderChunks = new Proxy({}, {
    get(target, prop) {
        Debug.deprecated(`Using shaderChunks to access global shader chunks is deprecated. Use ShaderChunks.get instead, for example: ShaderChunks.get(this.app.graphicsDevice, SHADERLANGUAGE_GLSL).get('${prop}');`);
        return ShaderChunks.get(getApplication().graphicsDevice, SHADERLANGUAGE_GLSL).get(prop);
    },
    set(target, prop, value) {
        Debug.deprecated(`Using shaderChunks to override global shader chunks is deprecated. Use ShaderChunks.get instead, for example: ShaderChunks.get(this.app.graphicsDevice, SHADERLANGUAGE_GLSL).set('${prop}');`);
        ShaderChunks.get(getApplication().graphicsDevice, SHADERLANGUAGE_GLSL).set(prop, value);
        return true;
    }
});

// INPUT

/**
 * @deprecated Use Keyboard.EVENT_KEYDOWN instead.
 * @ignore
 */
export const EVENT_KEYDOWN = 'keydown';

/**
 * @deprecated Use Keyboard.EVENT_KEYUP instead.
 * @ignore
 */
export const EVENT_KEYUP = 'keyup';

/**
 * @deprecated Use Mouse.EVENT_MOUSEDOWN instead.
 * @ignore
 */
export const EVENT_MOUSEDOWN = 'mousedown';

/**
 * @deprecated Use Mouse.EVENT_MOUSEMOVE instead.
 * @ignore
 */
export const EVENT_MOUSEMOVE = 'mousemove';

/**
 * @deprecated Use Mouse.EVENT_MOUSEUP instead.
 * @ignore
 */
export const EVENT_MOUSEUP = 'mouseup';

/**
 * @deprecated Use Mouse.EVENT_MOUSEWHEEL instead.
 * @ignore
 */
export const EVENT_MOUSEWHEEL = 'mousewheel';

/**
 * @deprecated Use TouchDevice.EVENT_TOUCHSTART instead.
 * @ignore
 */
export const EVENT_TOUCHSTART = 'touchstart';

/**
 * @deprecated Use TouchDevice.EVENT_TOUCHEND instead.
 * @ignore
 */
export const EVENT_TOUCHEND = 'touchend';

/**
 * @deprecated Use TouchDevice.EVENT_TOUCHMOVE instead.
 * @ignore
 */
export const EVENT_TOUCHMOVE = 'touchmove';

/**
 * @deprecated Use TouchDevice.EVENT_TOUCHCANCEL instead.
 * @ignore
 */
export const EVENT_TOUCHCANCEL = 'touchcancel';

/**
 * @deprecated Use GamePads.EVENT_GAMEPADCONNECTED instead.
 * @ignore
 */
export const EVENT_GAMEPADCONNECTED = 'gamepadconnected';

/**
 * @deprecated Use GamePads.EVENT_GAMEPADDISCONNECTED instead.
 * @ignore
 */
export const EVENT_GAMEPADDISCONNECTED = 'gamepaddisconnected';

/**
 * @deprecated Use XrInput.EVENT_SELECT instead.
 * @ignore
 */
export const EVENT_SELECT = 'select';

/**
 * @deprecated Use XrInput.EVENT_SELECTSTART instead.
 * @ignore
 */
export const EVENT_SELECTSTART = 'selectstart';

/**
 * @deprecated Use XrInput.EVENT_SELECTEND instead.
 * @ignore
 */
export const EVENT_SELECTEND = 'selectend';

// FRAMEWORK

// Bullet collision flags and activation states, only meaningful when passed to the native Ammo.js
// body (RigidBodyComponent#body). The physics components never take them.
export const BODYFLAG_STATIC_OBJECT = CF_STATIC_OBJECT;
export const BODYFLAG_KINEMATIC_OBJECT = CF_KINEMATIC_OBJECT;
export const BODYFLAG_NORESPONSE_OBJECT = CF_NO_CONTACT_RESPONSE;
export const BODYSTATE_ACTIVE_TAG = ACTIVE_TAG;
export const BODYSTATE_ISLAND_SLEEPING = ISLAND_SLEEPING;
export const BODYSTATE_WANTS_DEACTIVATION = WANTS_DEACTIVATION;
export const BODYSTATE_DISABLE_DEACTIVATION = DISABLE_DEACTIVATION;
export const BODYSTATE_DISABLE_SIMULATION = DISABLE_SIMULATION;

/**
 * @deprecated Use BODYTYPE_STATIC instead.
 * @ignore
 */
export const RIGIDBODY_TYPE_STATIC = BODYTYPE_STATIC;

/**
 * @deprecated Use BODYTYPE_DYNAMIC instead.
 * @ignore
 */
export const RIGIDBODY_TYPE_DYNAMIC = BODYTYPE_DYNAMIC;

/**
 * @deprecated Use BODYTYPE_KINEMATIC instead.
 * @ignore
 */
export const RIGIDBODY_TYPE_KINEMATIC = BODYTYPE_KINEMATIC;

/**
 * @deprecated Use BODYFLAG_STATIC_OBJECT instead.
 * @ignore
 */
export const RIGIDBODY_CF_STATIC_OBJECT = BODYFLAG_STATIC_OBJECT;

/**
 * @deprecated Use BODYFLAG_KINEMATIC_OBJECT instead.
 * @ignore
 */
export const RIGIDBODY_CF_KINEMATIC_OBJECT = BODYFLAG_KINEMATIC_OBJECT;

/**
 * @deprecated Use BODYFLAG_NORESPONSE_OBJECT instead.
 * @ignore
 */
export const RIGIDBODY_CF_NORESPONSE_OBJECT = BODYFLAG_NORESPONSE_OBJECT;

/**
 * @deprecated Use BODYSTATE_ACTIVE_TAG instead.
 * @ignore
 */
export const RIGIDBODY_ACTIVE_TAG = BODYSTATE_ACTIVE_TAG;

/**
 * @deprecated Use BODYSTATE_ISLAND_SLEEPING instead.
 * @ignore
 */
export const RIGIDBODY_ISLAND_SLEEPING = BODYSTATE_ISLAND_SLEEPING;

/**
 * @deprecated Use BODYSTATE_WANTS_DEACTIVATION instead.
 * @ignore
 */
export const RIGIDBODY_WANTS_DEACTIVATION = BODYSTATE_WANTS_DEACTIVATION;

/**
 * @deprecated Use BODYSTATE_DISABLE_DEACTIVATION instead.
 * @ignore
 */
export const RIGIDBODY_DISABLE_DEACTIVATION = BODYSTATE_DISABLE_DEACTIVATION;

/**
 * @deprecated Use BODYSTATE_DISABLE_SIMULATION instead.
 * @ignore
 */
export const RIGIDBODY_DISABLE_SIMULATION = BODYSTATE_DISABLE_SIMULATION;
