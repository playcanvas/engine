// This module must stay free of module-scope side effects: everything here is a plain alias or a
// deprecated helper function, so bundlers can drop it entirely when unused (package.json declares
// "sideEffects": false). Prototype-patch shims live at the bottom of the module that defines the
// class they patch, so they only ship when that class does.

import { Debug } from '../core/debug.js';

import { Vec4 } from '../core/math/vec4.js';

import {
    BLENDMODE_CONSTANT, BLENDMODE_ONE_MINUS_CONSTANT,
    PIXELFORMAT_LA8, PIXELFORMAT_RGB565, PIXELFORMAT_RGBA5551, PIXELFORMAT_RGBA4, PIXELFORMAT_RGB8, PIXELFORMAT_RGBA8,
    PIXELFORMAT_SRGB8, PIXELFORMAT_SRGBA8,
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
    BODYFLAG_KINEMATIC_OBJECT, BODYFLAG_NORESPONSE_OBJECT, BODYFLAG_STATIC_OBJECT,
    BODYSTATE_ACTIVE_TAG, BODYSTATE_DISABLE_DEACTIVATION, BODYSTATE_DISABLE_SIMULATION, BODYSTATE_ISLAND_SLEEPING, BODYSTATE_WANTS_DEACTIVATION,
    BODYTYPE_DYNAMIC, BODYTYPE_KINEMATIC, BODYTYPE_STATIC
} from '../framework/components/rigid-body/constants.js';

// GRAPHICS

export const PIXELFORMAT_L8_A8 = PIXELFORMAT_LA8;
export const PIXELFORMAT_R5_G6_B5 = PIXELFORMAT_RGB565;
export const PIXELFORMAT_R5_G5_B5_A1 = PIXELFORMAT_RGBA5551;
export const PIXELFORMAT_R4_G4_B4_A4 = PIXELFORMAT_RGBA4;
export const PIXELFORMAT_R8_G8_B8 = PIXELFORMAT_RGB8;
export const PIXELFORMAT_R8_G8_B8_A8 = PIXELFORMAT_RGBA8;
export const PIXELFORMAT_SRGB = PIXELFORMAT_SRGB8;
export const PIXELFORMAT_SRGBA = PIXELFORMAT_SRGBA8;

export const BLENDMODE_CONSTANT_COLOR = BLENDMODE_CONSTANT;
export const BLENDMODE_ONE_MINUS_CONSTANT_COLOR = BLENDMODE_ONE_MINUS_CONSTANT;
export const BLENDMODE_CONSTANT_ALPHA = BLENDMODE_CONSTANT;
export const BLENDMODE_ONE_MINUS_CONSTANT_ALPHA = BLENDMODE_ONE_MINUS_CONSTANT;

export const CHUNKAPI_1_51 = '1.51';
export const CHUNKAPI_1_55 = '1.55';
export const CHUNKAPI_1_56 = '1.56';
export const CHUNKAPI_1_57 = '1.57';
export const CHUNKAPI_1_58 = '1.58';
export const CHUNKAPI_1_60 = '1.60';
export const CHUNKAPI_1_62 = '1.62';
export const CHUNKAPI_1_65 = '1.65';
export const CHUNKAPI_1_70 = '1.70';
export const CHUNKAPI_2_1 = '2.1';
export const CHUNKAPI_2_3 = '2.3';
export const CHUNKAPI_2_5 = '2.5';
export const CHUNKAPI_2_6 = '2.6';
export const CHUNKAPI_2_7 = '2.7';
export const CHUNKAPI_2_8 = '2.8';

const _viewport = new Vec4();

export function createSphere(device, opts) {
    Debug.deprecated('createSphere is deprecated. Use \'Mesh.fromGeometry(device, new SphereGeometry(options));\' format instead.');
    return Mesh.fromGeometry(device, new SphereGeometry(opts));
}

export function createPlane(device, opts) {
    Debug.deprecated('createPlane is deprecated. Use \'Mesh.fromGeometry(device, new PlaneGeometry(options));\' format instead.');
    return Mesh.fromGeometry(device, new PlaneGeometry(opts));
}

export function createBox(device, opts) {
    Debug.deprecated('createBox is deprecated. Use \'Mesh.fromGeometry(device, new BoxGeometry(options));\' format instead.');
    return Mesh.fromGeometry(device, new BoxGeometry(opts));
}

export function createTorus(device, opts) {
    Debug.deprecated('createTorus is deprecated. Use \'Mesh.fromGeometry(device, new TorusGeometry(options));\' format instead.');
    return Mesh.fromGeometry(device, new TorusGeometry(opts));
}

export function createCapsule(device, opts) {
    Debug.deprecated('createCapsule is deprecated. Use \'Mesh.fromGeometry(device, new CapsuleGeometry(options));\' format instead.');
    return Mesh.fromGeometry(device, new CapsuleGeometry(opts));
}

export function createCone(device, opts) {
    Debug.deprecated('createCone is deprecated. Use \'Mesh.fromGeometry(device, new ConeGeometry(options));\' format instead.');
    return Mesh.fromGeometry(device, new ConeGeometry(opts));
}

export function createCylinder(device, opts) {
    Debug.deprecated('createCylinder is deprecated. Use \'Mesh.fromGeometry(device, new CylinderGeometry(options));\' format instead.');
    return Mesh.fromGeometry(device, new CylinderGeometry(opts));
}

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

export function drawFullscreenQuad(device, target, vertexBuffer, shader, rect) {

    Debug.deprecated('drawFullscreenQuad is deprecated. When used as part of PostEffect, use PostEffect#drawQuad instead.');

    // convert rect in normalized space to viewport in pixel space
    let viewport;
    if (rect) {
        const w = target ? target.width : device.width;
        const h = target ? target.height : device.height;
        viewport = _viewport.set(rect.x * w, rect.y * h, rect.z * w, rect.w * h);
    }

    drawQuadWithShader(device, target, shader, viewport);
}

// SCENE

export const Key = AnimationKey;
export const Node = AnimationNode;

export const LitOptions = LitShaderOptions;

// deprecated access to global shader chunks
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

export const EVENT_KEYDOWN = 'keydown';
export const EVENT_KEYUP = 'keyup';

export const EVENT_MOUSEDOWN = 'mousedown';
export const EVENT_MOUSEMOVE = 'mousemove';
export const EVENT_MOUSEUP = 'mouseup';
export const EVENT_MOUSEWHEEL = 'mousewheel';

export const EVENT_TOUCHSTART = 'touchstart';
export const EVENT_TOUCHEND = 'touchend';
export const EVENT_TOUCHMOVE = 'touchmove';
export const EVENT_TOUCHCANCEL = 'touchcancel';

export const EVENT_GAMEPADCONNECTED = 'gamepadconnected';
export const EVENT_GAMEPADDISCONNECTED = 'gamepaddisconnected';

export const EVENT_SELECT = 'select';
export const EVENT_SELECTSTART = 'selectstart';
export const EVENT_SELECTEND = 'selectend';

// FRAMEWORK

export const RIGIDBODY_TYPE_STATIC = BODYTYPE_STATIC;
export const RIGIDBODY_TYPE_DYNAMIC = BODYTYPE_DYNAMIC;
export const RIGIDBODY_TYPE_KINEMATIC = BODYTYPE_KINEMATIC;
export const RIGIDBODY_CF_STATIC_OBJECT = BODYFLAG_STATIC_OBJECT;
export const RIGIDBODY_CF_KINEMATIC_OBJECT = BODYFLAG_KINEMATIC_OBJECT;
export const RIGIDBODY_CF_NORESPONSE_OBJECT = BODYFLAG_NORESPONSE_OBJECT;
export const RIGIDBODY_ACTIVE_TAG = BODYSTATE_ACTIVE_TAG;
export const RIGIDBODY_ISLAND_SLEEPING = BODYSTATE_ISLAND_SLEEPING;
export const RIGIDBODY_WANTS_DEACTIVATION = BODYSTATE_WANTS_DEACTIVATION;
export const RIGIDBODY_DISABLE_DEACTIVATION = BODYSTATE_DISABLE_DEACTIVATION;
export const RIGIDBODY_DISABLE_SIMULATION = BODYSTATE_DISABLE_SIMULATION;
