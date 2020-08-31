import { revision, version } from './core/core.js';
import { string } from './core/string.js';
import { Color } from './core/color.js';
import { Timer, now } from "../src/core/time";

import { math } from './math/math.js';
import { Mat4 } from './math/mat4.js';
import { Vec2 } from './math/vec2.js';
import { Vec3 } from './math/vec3.js';
import { Vec4 } from './math/vec4.js';

import { BoundingBox } from './shape/bounding-box.js';
import { BoundingSphere } from './shape/bounding-sphere.js';
import { Frustum } from './shape/frustum.js';
import { Plane } from './shape/plane.js';

import {
    ADDRESS_CLAMP_TO_EDGE, ADDRESS_MIRRORED_REPEAT, ADDRESS_REPEAT,
    BLENDMODE_ZERO, BLENDMODE_ONE, BLENDMODE_SRC_COLOR, BLENDMODE_ONE_MINUS_SRC_COLOR,
    BLENDMODE_DST_COLOR, BLENDMODE_ONE_MINUS_DST_COLOR, BLENDMODE_SRC_ALPHA, BLENDMODE_SRC_ALPHA_SATURATE,
    BLENDMODE_ONE_MINUS_SRC_ALPHA, BLENDMODE_DST_ALPHA, BLENDMODE_ONE_MINUS_DST_ALPHA,
    BUFFER_STATIC, BUFFER_DYNAMIC, BUFFER_STREAM,
    CULLFACE_NONE, CULLFACE_BACK, CULLFACE_FRONT, CULLFACE_FRONTANDBACK,
    FILTER_NEAREST, FILTER_LINEAR, FILTER_NEAREST_MIPMAP_NEAREST, FILTER_NEAREST_MIPMAP_LINEAR,
    FILTER_LINEAR_MIPMAP_NEAREST, FILTER_LINEAR_MIPMAP_LINEAR,
    INDEXFORMAT_UINT8, INDEXFORMAT_UINT16, INDEXFORMAT_UINT32,
    PIXELFORMAT_R5_G6_B5, PIXELFORMAT_R8_G8_B8, PIXELFORMAT_R8_G8_B8_A8,
    PRIMITIVE_POINTS, PRIMITIVE_LINES, PRIMITIVE_LINELOOP, PRIMITIVE_LINESTRIP,
    PRIMITIVE_TRIANGLES, PRIMITIVE_TRISTRIP, PRIMITIVE_TRIFAN,
    SEMANTIC_POSITION, SEMANTIC_NORMAL, SEMANTIC_COLOR, SEMANTIC_TEXCOORD, SEMANTIC_TEXCOORD0,
    SEMANTIC_TEXCOORD1, SEMANTIC_ATTR0, SEMANTIC_ATTR1, SEMANTIC_ATTR2, SEMANTIC_ATTR3,
    TEXTURELOCK_READ, TEXTURELOCK_WRITE,
    TEXTURETYPE_DEFAULT, TEXTURETYPE_RGBM, TEXTURETYPE_SWIZZLEGGGR,
    TYPE_INT8, TYPE_UINT8, TYPE_INT16, TYPE_UINT16, TYPE_INT32, TYPE_UINT32, TYPE_FLOAT32
} from './graphics/graphics.js';
import { drawQuadWithShader } from './graphics/simple-post-effect.js';
import { programlib } from './graphics/program-lib/program-lib.js';
import { shaderChunks } from './graphics/program-lib/chunks/chunks.js';
import { GraphicsDevice } from './graphics/device.js';
import { IndexBuffer } from './graphics/index-buffer.js';
import { createFullscreenQuad, drawFullscreenQuad, PostEffect } from './graphics/post-effect.js';
import { PostEffectQueue } from './framework/components/camera/post-effect-queue.js';
import { ProgramLibrary } from './graphics/program-library.js';
import { RenderTarget } from './graphics/render-target.js';
import { ScopeId } from './graphics/scope-id.js';
import { Shader } from './graphics/shader.js';
import { ShaderInput } from './graphics/shader-input.js';
import { Texture } from './graphics/texture.js';
import { VertexBuffer } from './graphics/vertex-buffer.js';
import { VertexFormat } from './graphics/vertex-format.js';
import { VertexIterator } from './graphics/vertex-iterator.js';

import { PROJECTION_ORTHOGRAPHIC, PROJECTION_PERSPECTIVE } from './scene/constants.js';
import { calculateTangents, createBox, createCapsule, createCone, createCylinder, createMesh, createPlane, createSphere, createTorus } from './scene/procedural.js';
import { partitionSkin } from './scene/skin-partition.js';
import { BasicMaterial } from './scene/materials/basic-material.js';
import { DepthMaterial } from './scene/materials/depth-material.js';
import { ForwardRenderer } from './scene/forward-renderer.js';
import { GraphNode } from './scene/graph-node.js';
import { Material } from './scene/materials/material.js';
import { Mesh } from './scene/mesh.js';
import { MeshInstance, Command } from './scene/mesh-instance.js';
import { Model } from './scene/model.js';
import { ParticleEmitter } from './scene/particle-system/particle-emitter.js';
import { Picker } from './scene/pick.js';
import { Scene } from './scene/scene.js';
import { Skin, SkinInstance } from './scene/skin.js';
import { StandardMaterial } from './scene/materials/standard-material.js';

import { Animation, Key, Node } from './anim/animation.js';
import { Skeleton } from './anim/skeleton.js';

import { Channel } from './audio/channel.js';
import { Channel3d } from './audio/channel3d.js';
import { Listener } from './sound/listener.js';
import { Sound } from './sound/sound.js';
import { SoundManager } from './sound/manager.js';

import { AssetRegistry } from './asset/asset-registry.js';

import { XrInputSource } from './xr/xr-input-source.js';

import { Controller } from './input/controller.js';
import { ElementInput } from './input/element-input.js';
import { GamePads } from './input/game-pads.js';
import { Keyboard, KeyboardEvent } from './input/keyboard.js';
import { Mouse, MouseEvent } from './input/mouse.js';
import { getTouchTargetCoords, Touch, TouchDevice, TouchEvent } from './input/touch.js';

import { FILLMODE_FILL_WINDOW, FILLMODE_KEEP_ASPECT, FILLMODE_NONE, RESOLUTION_AUTO, RESOLUTION_FIXED } from './framework/constants.js';
import { Application } from './framework/application.js';
import { CameraComponent } from './framework/components/camera/component.js';
import { Component } from './framework/components/component.js';
import { ComponentData } from './framework/components/data.js';
import { ComponentSystem } from './framework/components/system.js';
import { Entity } from './framework/entity.js';
import { LightComponent } from './framework/components/light/component.js';
import { ModelComponent } from './framework/components/model/component.js';
import {
    BODYFLAG_KINEMATIC_OBJECT, BODYFLAG_NORESPONSE_OBJECT, BODYFLAG_STATIC_OBJECT,
    BODYSTATE_ACTIVE_TAG, BODYSTATE_DISABLE_DEACTIVATION, BODYSTATE_DISABLE_SIMULATION, BODYSTATE_ISLAND_SLEEPING, BODYSTATE_WANTS_DEACTIVATION,
    BODYTYPE_DYNAMIC, BODYTYPE_KINEMATIC, BODYTYPE_STATIC
} from './framework/components/rigid-body/constants.js';
import { RigidBodyComponent } from './framework/components/rigid-body/component.js';
import { RigidBodyComponentSystem } from './framework/components/rigid-body/system.js';

// CORE

export var log = {
    write: function (text) {
        // #ifdef DEBUG
        console.warn("DEPRECATED: pc.log.write is deprecated. Use console.log instead.");
        // #endif
        console.log(text);
    },

    open: function () {
        // #ifdef DEBUG
        console.warn("DEPRECATED: pc.log.open is deprecated. Use console.log instead.");
        // #endif
        log.write("Powered by PlayCanvas " + version + " " + revision);
    },

    info: function (text) {
        // #ifdef DEBUG
        console.warn("DEPRECATED: pc.log.info is deprecated. Use console.info instead.");
        // #endif
        console.info("INFO:    " + text);
    },

    debug: function (text) {
        // #ifdef DEBUG
        console.warn("DEPRECATED: pc.log.debug is deprecated. Use console.debug instead.");
        // #endif
        console.debug("DEBUG:   " + text);
    },

    error: function (text) {
        // #ifdef DEBUG
        console.warn("DEPRECATED: pc.log.error is deprecated. Use console.error instead.");
        // #endif
        console.error("ERROR:   " + text);
    },

    warning: function (text) {
        // #ifdef DEBUG
        console.warn("DEPRECATED: pc.log.warning is deprecated. Use console.warn instead.");
        // #endif
        console.warn("WARNING: " + text);
    },

    alert: function (text) {
        // #ifdef DEBUG
        console.warn("DEPRECATED: pc.log.alert is deprecated. Use alert instead.");
        // #endif
        log.write("ALERT:   " + text);
        alert(text); // eslint-disable-line no-alert
    },

    assert: function (condition, text) {
        // #ifdef DEBUG
        console.warn("DEPRECATED: pc.log.assert is deprecated. Use a conditional plus console.log instead.");
        // #endif
        if (condition === false) {
            log.write("ASSERT:  " + text);
        }
    }
};

string.endsWith = function (s, subs) {
    // #ifdef DEBUG
    console.warn("DEPRECATED: pc.string.endsWith is deprecated. Use String#endsWith instead.");
    // #endif
    return s.endsWith(subs);
};

string.startsWith = function (s, subs) {
    // #ifdef DEBUG
    console.warn("DEPRECATED: pc.string.startsWith is deprecated. Use String#startsWith instead.");
    // #endif
    return s.startsWith(subs);
};

export var time = {
    now: now,
    Timer: Timer
};

Object.defineProperty(Color.prototype, "data", {
    get: function () {
        // #ifdef DEBUG
        console.warn('pc.Color#data is not public API and should not be used. Access color components via their individual properties.');
        // #endif
        if (!this._data) {
            this._data = new Float32Array(4);
        }
        this._data[0] = this.r;
        this._data[1] = this.g;
        this._data[2] = this.b;
        this._data[3] = this.a;
        return this._data;
    }
});

Object.defineProperty(Color.prototype, "data3", {
    get: function () {
        // #ifdef DEBUG
        console.warn('pc.Color#data3 is not public API and should not be used. Access color components via their individual properties.');
        // #endif
        if (!this._data3) {
            this._data3 = new Float32Array(3);
        }
        this._data3[0] = this.r;
        this._data3[1] = this.g;
        this._data3[2] = this.b;
        return this._data3;
    }
});

export function inherits(Self, Super) {
    var Temp = function () {};
    var Func = function (arg1, arg2, arg3, arg4, arg5, arg6, arg7, arg8) {
        Super.call(this, arg1, arg2, arg3, arg4, arg5, arg6, arg7, arg8);
        Self.call(this, arg1, arg2, arg3, arg4, arg5, arg6, arg7, arg8);
        // this.constructor = Self;
    };
    Func._super = Super.prototype;
    Temp.prototype = Super.prototype;
    Func.prototype = new Temp();

    return Func;
}

export function makeArray(arr) {
    // #ifdef DEBUG
    console.warn('pc.makeArray is not public API and should not be used. Use Array.prototype.slice.call instead.');
    // #endif
    return Array.prototype.slice.call(arr);
}

// MATH

math.INV_LOG2 = Math.LOG2E;

math.intToBytes = math.intToBytes32;
math.bytesToInt = math.bytesToInt32;

Object.defineProperty(Vec2.prototype, "data", {
    get: function () {
        // #ifdef DEBUG
        console.warn('pc.Vec2#data is not public API and should not be used. Access vector components via their individual properties.');
        // #endif
        if (!this._data) {
            this._data = new Float32Array(2);
        }
        this._data[0] = this.x;
        this._data[1] = this.y;
        return this._data;
    }
});

Object.defineProperty(Vec3.prototype, "data", {
    get: function () {
        // #ifdef DEBUG
        console.warn('pc.Vec3#data is not public API and should not be used. Access vector components via their individual properties.');
        // #endif
        if (!this._data) {
            this._data = new Float32Array(3);
        }
        this._data[0] = this.x;
        this._data[1] = this.y;
        this._data[2] = this.z;
        return this._data;
    }
});

Object.defineProperty(Vec4.prototype, "data", {
    get: function () {
        // #ifdef DEBUG
        console.warn('pc.Vec4#data is not public API and should not be used. Access vector components via their individual properties.');
        // #endif
        if (!this._data) {
            this._data = new Float32Array(4);
        }
        this._data[0] = this.x;
        this._data[1] = this.y;
        this._data[2] = this.z;
        this._data[3] = this.w;
        return this._data;
    }
});

// SHAPE

export var shape = {
    Aabb: BoundingBox,
    Sphere: BoundingSphere,
    Plane: Plane
};

BoundingSphere.prototype.intersectRay = BoundingSphere.prototype.intersectsRay;

Frustum.prototype.update = function (projectionMatrix, viewMatrix) {
    // #ifdef DEBUG
    console.warn('DEPRECATED: pc.Frustum#update is deprecated. Use pc.Frustum#setFromMat4 instead.');
    // #endif

    var viewProj = new Mat4();

    viewProj.mul2(projectionMatrix, viewMatrix);

    this.setFromMat4(viewProj);
};

// GRAPHICS

export var ELEMENTTYPE_INT8 = TYPE_INT8;
export var ELEMENTTYPE_UINT8 = TYPE_UINT8;
export var ELEMENTTYPE_INT16 = TYPE_INT16;
export var ELEMENTTYPE_UINT16 = TYPE_UINT16;
export var ELEMENTTYPE_INT32 = TYPE_INT32;
export var ELEMENTTYPE_UINT32 = TYPE_UINT32;
export var ELEMENTTYPE_FLOAT32 = TYPE_FLOAT32;

export function UnsupportedBrowserError(message) {
    this.name = "UnsupportedBrowserError";
    this.message = (message || "");
}
UnsupportedBrowserError.prototype = Error.prototype;

export function ContextCreationError(message) {
    this.name = "ContextCreationError";
    this.message = (message || "");
}
ContextCreationError.prototype = Error.prototype;

export var gfx = {
    ADDRESS_CLAMP_TO_EDGE: ADDRESS_CLAMP_TO_EDGE,
    ADDRESS_MIRRORED_REPEAT: ADDRESS_MIRRORED_REPEAT,
    ADDRESS_REPEAT: ADDRESS_REPEAT,
    BLENDMODE_ZERO: BLENDMODE_ZERO,
    BLENDMODE_ONE: BLENDMODE_ONE,
    BLENDMODE_SRC_COLOR: BLENDMODE_SRC_COLOR,
    BLENDMODE_ONE_MINUS_SRC_COLOR: BLENDMODE_ONE_MINUS_SRC_COLOR,
    BLENDMODE_DST_COLOR: BLENDMODE_DST_COLOR,
    BLENDMODE_ONE_MINUS_DST_COLOR: BLENDMODE_ONE_MINUS_DST_COLOR,
    BLENDMODE_SRC_ALPHA: BLENDMODE_SRC_ALPHA,
    BLENDMODE_SRC_ALPHA_SATURATE: BLENDMODE_SRC_ALPHA_SATURATE,
    BLENDMODE_ONE_MINUS_SRC_ALPHA: BLENDMODE_ONE_MINUS_SRC_ALPHA,
    BLENDMODE_DST_ALPHA: BLENDMODE_DST_ALPHA,
    BLENDMODE_ONE_MINUS_DST_ALPHA: BLENDMODE_ONE_MINUS_DST_ALPHA,
    BUFFER_STATIC: BUFFER_STATIC,
    BUFFER_DYNAMIC: BUFFER_DYNAMIC,
    BUFFER_STREAM: BUFFER_STREAM,
    CULLFACE_NONE: CULLFACE_NONE,
    CULLFACE_BACK: CULLFACE_BACK,
    CULLFACE_FRONT: CULLFACE_FRONT,
    CULLFACE_FRONTANDBACK: CULLFACE_FRONTANDBACK,
    ELEMENTTYPE_INT8: TYPE_INT8,
    ELEMENTTYPE_UINT8: TYPE_UINT8,
    ELEMENTTYPE_INT16: TYPE_INT16,
    ELEMENTTYPE_UINT16: TYPE_UINT16,
    ELEMENTTYPE_INT32: TYPE_INT32,
    ELEMENTTYPE_UINT32: TYPE_UINT32,
    ELEMENTTYPE_FLOAT32: TYPE_FLOAT32,
    FILTER_NEAREST: FILTER_NEAREST,
    FILTER_LINEAR: FILTER_LINEAR,
    FILTER_NEAREST_MIPMAP_NEAREST: FILTER_NEAREST_MIPMAP_NEAREST,
    FILTER_NEAREST_MIPMAP_LINEAR: FILTER_NEAREST_MIPMAP_LINEAR,
    FILTER_LINEAR_MIPMAP_NEAREST: FILTER_LINEAR_MIPMAP_NEAREST,
    FILTER_LINEAR_MIPMAP_LINEAR: FILTER_LINEAR_MIPMAP_LINEAR,
    INDEXFORMAT_UINT8: INDEXFORMAT_UINT8,
    INDEXFORMAT_UINT16: INDEXFORMAT_UINT16,
    INDEXFORMAT_UINT32: INDEXFORMAT_UINT32,
    PIXELFORMAT_R5_G6_B5: PIXELFORMAT_R5_G6_B5,
    PIXELFORMAT_R8_G8_B8: PIXELFORMAT_R8_G8_B8,
    PIXELFORMAT_R8_G8_B8_A8: PIXELFORMAT_R8_G8_B8_A8,
    PRIMITIVE_POINTS: PRIMITIVE_POINTS,
    PRIMITIVE_LINES: PRIMITIVE_LINES,
    PRIMITIVE_LINELOOP: PRIMITIVE_LINELOOP,
    PRIMITIVE_LINESTRIP: PRIMITIVE_LINESTRIP,
    PRIMITIVE_TRIANGLES: PRIMITIVE_TRIANGLES,
    PRIMITIVE_TRISTRIP: PRIMITIVE_TRISTRIP,
    PRIMITIVE_TRIFAN: PRIMITIVE_TRIFAN,
    SEMANTIC_POSITION: SEMANTIC_POSITION,
    SEMANTIC_NORMAL: SEMANTIC_NORMAL,
    SEMANTIC_COLOR: SEMANTIC_COLOR,
    SEMANTIC_TEXCOORD: SEMANTIC_TEXCOORD,
    SEMANTIC_TEXCOORD0: SEMANTIC_TEXCOORD0,
    SEMANTIC_TEXCOORD1: SEMANTIC_TEXCOORD1,
    SEMANTIC_ATTR0: SEMANTIC_ATTR0,
    SEMANTIC_ATTR1: SEMANTIC_ATTR1,
    SEMANTIC_ATTR2: SEMANTIC_ATTR2,
    SEMANTIC_ATTR3: SEMANTIC_ATTR3,
    TEXTURELOCK_READ: TEXTURELOCK_READ,
    TEXTURELOCK_WRITE: TEXTURELOCK_WRITE,
    drawQuadWithShader: drawQuadWithShader,
    programlib: programlib,
    shaderChunks: shaderChunks,
    ContextCreationError: ContextCreationError,
    Device: GraphicsDevice,
    IndexBuffer: IndexBuffer,
    ProgramLibrary: ProgramLibrary,
    RenderTarget: RenderTarget,
    ScopeId: ScopeId,
    Shader: Shader,
    ShaderInput: ShaderInput,
    Texture: Texture,
    UnsupportedBrowserError: UnsupportedBrowserError,
    VertexBuffer: VertexBuffer,
    VertexFormat: VertexFormat,
    VertexIterator: VertexIterator
};

export var posteffect = {
    createFullscreenQuad: createFullscreenQuad,
    drawFullscreenQuad: drawFullscreenQuad,
    PostEffect: PostEffect,
    PostEffectQueue: PostEffectQueue
};

Object.defineProperty(shaderChunks, "transformSkinnedVS", {
    get: function () {
        return "#define SKIN\n" + shaderChunks.transformVS;
    }
});

Object.defineProperties(Texture.prototype, {
    rgbm: {
        get: function () {
            // #ifdef DEBUG
            console.warn("DEPRECATED: pc.Texture#rgbm is deprecated. Use pc.Texture#type instead.");
            // #endif
            return this.type === TEXTURETYPE_RGBM;
        },
        set: function (rgbm) {
            // #ifdef DEBUG
            console.warn("DEPRECATED: pc.Texture#rgbm is deprecated. Use pc.Texture#type instead.");
            // #endif
            this.type = rgbm ? TEXTURETYPE_RGBM : TEXTURETYPE_DEFAULT;
        }
    },

    swizzleGGGR: {
        get: function () {
            // #ifdef DEBUG
            console.warn("DEPRECATED: pc.Texture#swizzleGGGR is deprecated. Use pc.Texture#type instead.");
            // #endif
            return this.type === TEXTURETYPE_SWIZZLEGGGR;
        },
        set: function (swizzleGGGR) {
            // #ifdef DEBUG
            console.warn("DEPRECATED: pc.Texture#swizzleGGGR is deprecated. Use pc.Texture#type instead.");
            // #endif
            this.type = swizzleGGGR ? TEXTURETYPE_SWIZZLEGGGR : TEXTURETYPE_DEFAULT;
        }
    }
});

// SCENE

export var PhongMaterial = StandardMaterial;

export var scene = {
    partitionSkin: partitionSkin,
    procedural: {
        calculateTangents: calculateTangents,
        createMesh: createMesh,
        createTorus: createTorus,
        createCylinder: createCylinder,
        createCapsule: createCapsule,
        createCone: createCone,
        createSphere: createSphere,
        createPlane: createPlane,
        createBox: createBox
    },
    BasicMaterial: BasicMaterial,
    Command: Command,
    DepthMaterial: DepthMaterial,
    ForwardRenderer: ForwardRenderer,
    GraphNode: GraphNode,
    Material: Material,
    Mesh: Mesh,
    MeshInstance: MeshInstance,
    Model: Model,
    ParticleEmitter: ParticleEmitter,
    PhongMaterial: StandardMaterial,
    Picker: Picker,
    Projection: {
        ORTHOGRAPHIC: PROJECTION_ORTHOGRAPHIC,
        PERSPECTIVE: PROJECTION_PERSPECTIVE
    },
    Scene: Scene,
    Skin: Skin,
    SkinInstance: SkinInstance
};

GraphNode.prototype._dirtify = function (local) {
    // #ifdef DEBUG
    console.warn('DEPRECATED: pc.GraphNode#_dirtify is deprecated. Use pc.GraphNode#_dirtifyLocal or _dirtifyWorld respectively instead.');
    // #endif
    if (local)
        this._dirtifyLocal();
    else
        this._dirtifyWorld();
};

GraphNode.prototype.addLabel = function (label) {
    // #ifdef DEBUG
    console.warn('DEPRECATED: pc.GraphNode#addLabel is deprecated. Use pc.GraphNode#tags instead.');
    // #endif

    this._labels[label] = true;
};

GraphNode.prototype.getLabels = function () {
    // #ifdef DEBUG
    console.warn('DEPRECATED: pc.GraphNode#getLabels is deprecated. Use pc.GraphNode#tags instead.');
    // #endif

    return Object.keys(this._labels);
};

GraphNode.prototype.hasLabel = function (label) {
    // #ifdef DEBUG
    console.warn('DEPRECATED: pc.GraphNode#hasLabel is deprecated. Use pc.GraphNode#tags instead.');
    // #endif

    return !!this._labels[label];
};

GraphNode.prototype.removeLabel = function (label) {
    // #ifdef DEBUG
    console.warn('DEPRECATED: pc.GraphNode#removeLabel is deprecated. Use pc.GraphNode#tags instead.');
    // #endif

    delete this._labels[label];
};

GraphNode.prototype.findByLabel = function (label, results) {
    // #ifdef DEBUG
    console.warn('DEPRECATED: pc.GraphNode#findByLabel is deprecated. Use pc.GraphNode#tags instead.');
    // #endif

    var i, length = this._children.length;
    results = results || [];

    if (this.hasLabel(label)) {
        results.push(this);
    }

    for (i = 0; i < length; ++i) {
        results = this._children[i].findByLabel(label, results);
    }

    return results;
};

GraphNode.prototype.getChildren = function () {
    // #ifdef DEBUG
    console.warn('DEPRECATED: pc.GraphNode#getChildren is deprecated. Use pc.GraphNode#children instead.');
    // #endif

    return this.children;
};

GraphNode.prototype.getName = function () {
    // #ifdef DEBUG
    console.warn('DEPRECATED: pc.GraphNode#getName is deprecated. Use pc.GraphNode#name instead.');
    // #endif

    return this.name;
};

GraphNode.prototype.getPath = function () {
    // #ifdef DEBUG
    console.warn('DEPRECATED: pc.GraphNode#getPath is deprecated. Use pc.GraphNode#path instead.');
    // #endif

    return this.path;
};

GraphNode.prototype.getRoot = function () {
    // #ifdef DEBUG
    console.warn('DEPRECATED: pc.GraphNode#getRoot is deprecated. Use pc.GraphNode#root instead.');
    // #endif

    return this.root;
};

GraphNode.prototype.getParent = function () {
    // #ifdef DEBUG
    console.warn('DEPRECATED: pc.GraphNode#getParent is deprecated. Use pc.GraphNode#parent instead.');
    // #endif

    return this.parent;
};

GraphNode.prototype.setName = function (name) {
    // #ifdef DEBUG
    console.warn('DEPRECATED: pc.GraphNode#setName is deprecated. Use pc.GraphNode#name instead.');
    // #endif

    this.name = name;
};

Material.prototype.getName = function () {
    // #ifdef DEBUG
    console.warn('DEPRECATED: pc.Material#getName is deprecated. Use pc.Material#name instead.');
    // #endif
    return this.name;
};

Material.prototype.setName = function (name) {
    // #ifdef DEBUG
    console.warn('DEPRECATED: pc.Material#setName is deprecated. Use pc.Material#name instead.');
    // #endif
    this.name = name;
};

Material.prototype.getShader = function () {
    // #ifdef DEBUG
    console.warn('DEPRECATED: pc.Material#getShader is deprecated. Use pc.Material#shader instead.');
    // #endif
    return this.shader;
};

Material.prototype.setShader = function (shader) {
    // #ifdef DEBUG
    console.warn('DEPRECATED: pc.Material#setShader is deprecated. Use pc.Material#shader instead.');
    // #endif
    this.shader = shader;
};

// ANIMATION

export var anim = {
    Animation: Animation,
    Key: Key,
    Node: Node,
    Skeleton: Skeleton
};

// SOUND

export var audio = {
    AudioManager: SoundManager,
    Channel: Channel,
    Channel3d: Channel3d,
    Listener: Listener,
    Sound: Sound
};

SoundManager.prototype.getListener = function () {
    // #ifdef DEBUG
    console.warn('DEPRECATED: pc.SoundManager#getListener is deprecated. Use pc.SoundManager#listener instead.');
    // #endif
    return this.listener;
};

SoundManager.prototype.getVolume = function () {
    // #ifdef DEBUG
    console.warn('DEPRECATED: pc.SoundManager#getVolume is deprecated. Use pc.SoundManager#volume instead.');
    // #endif
    return this.volume;
};

SoundManager.prototype.setVolume = function (volume) {
    // #ifdef DEBUG
    console.warn('DEPRECATED: pc.SoundManager#setVolume is deprecated. Use pc.SoundManager#volume instead.');
    // #endif
    this.volume = volume;
};

// ASSET

export var asset = {
    ASSET_ANIMATION: 'animation',
    ASSET_AUDIO: 'audio',
    ASSET_IMAGE: 'image',
    ASSET_JSON: 'json',
    ASSET_MODEL: 'model',
    ASSET_MATERIAL: 'material',
    ASSET_TEXT: 'text',
    ASSET_TEXTURE: 'texture',
    ASSET_CUBEMAP: 'cubemap',
    ASSET_SCRIPT: 'script'
};

AssetRegistry.prototype.getAssetById = function (id) {
    // #ifdef DEBUG
    console.warn("DEPRECATED: pc.AssetRegistry#getAssetById is deprecated. Use pc.AssetRegistry#get instead.");
    // #endif
    return this.get(id);
};

// XR

Object.defineProperty(XrInputSource.prototype, 'ray', {
    get: function () {
        // #ifdef DEBUG
        console.warn('DEPRECATED: pc.XrInputSource#ray is deprecated. Use pc.XrInputSource#getOrigin and pc.XrInputSource#getDirection instead.');
        // #endif
        return this._rayLocal;
    }
});

Object.defineProperty(XrInputSource.prototype, 'position', {
    get: function () {
        // #ifdef DEBUG
        console.warn('DEPRECATED: pc.XrInputSource#position is deprecated. Use pc.XrInputSource#getLocalPosition instead.');
        // #endif
        return this._localPosition;
    }
});

Object.defineProperty(XrInputSource.prototype, 'rotation', {
    get: function () {
        // #ifdef DEBUG
        console.warn('DEPRECATED: pc.XrInputSource#rotation is deprecated. Use pc.XrInputSource#getLocalRotation instead.');
        // #endif
        return this._localRotation;
    }
});

// INPUT

export var input = {
    getTouchTargetCoords: getTouchTargetCoords,
    Controller: Controller,
    GamePads: GamePads,
    Keyboard: Keyboard,
    KeyboardEvent: KeyboardEvent,
    Mouse: Mouse,
    MouseEvent: MouseEvent,
    Touch: Touch,
    TouchDevice: TouchDevice,
    TouchEvent: TouchEvent
};

Object.defineProperty(ElementInput.prototype, 'wheel', {
    get: function () {
        return this.wheelDelta * -2;
    }
});

Object.defineProperty(MouseEvent.prototype, 'wheel', {
    get: function () {
        return this.wheelDelta * -2;
    }
});

// FRAMEWORK

export var RIGIDBODY_TYPE_STATIC = BODYTYPE_STATIC;
export var RIGIDBODY_TYPE_DYNAMIC = BODYTYPE_DYNAMIC;
export var RIGIDBODY_TYPE_KINEMATIC = BODYTYPE_KINEMATIC;
export var RIGIDBODY_CF_STATIC_OBJECT = BODYFLAG_STATIC_OBJECT;
export var RIGIDBODY_CF_KINEMATIC_OBJECT = BODYFLAG_KINEMATIC_OBJECT;
export var RIGIDBODY_CF_NORESPONSE_OBJECT = BODYFLAG_NORESPONSE_OBJECT;
export var RIGIDBODY_ACTIVE_TAG = BODYSTATE_ACTIVE_TAG;
export var RIGIDBODY_ISLAND_SLEEPING = BODYSTATE_ISLAND_SLEEPING;
export var RIGIDBODY_WANTS_DEACTIVATION = BODYSTATE_WANTS_DEACTIVATION;
export var RIGIDBODY_DISABLE_DEACTIVATION = BODYSTATE_DISABLE_DEACTIVATION;
export var RIGIDBODY_DISABLE_SIMULATION = BODYSTATE_DISABLE_SIMULATION;

export var fw = {
    Application: Application,
    Component: Component,
    ComponentData: ComponentData,
    ComponentSystem: ComponentSystem,
    Entity: Entity,
    FillMode: {
        NONE: FILLMODE_NONE,
        FILL_WINDOW: FILLMODE_FILL_WINDOW,
        KEEP_ASPECT: FILLMODE_KEEP_ASPECT
    },
    ResolutionMode: {
        AUTO: RESOLUTION_AUTO,
        FIXED: RESOLUTION_FIXED
    }
};

Application.prototype.isFullscreen = function () {
    // #ifdef DEBUG
    console.warn('DEPRECATED: pc.Application#isFullscreen is deprecated. Use the Fullscreen API directly.');
    // #endif

    return !!document.fullscreenElement;
};

Application.prototype.enableFullscreen = function (element, success, error) {
    // #ifdef DEBUG
    console.warn('DEPRECATED: pc.Application#enableFullscreen is deprecated. Use the Fullscreen API directly.');
    // #endif

    element = element || this.graphicsDevice.canvas;

    // success callback
    var s = function () {
        success();
        document.removeEventListener('fullscreenchange', s);
    };

    // error callback
    var e = function () {
        error();
        document.removeEventListener('fullscreenerror', e);
    };

    if (success) {
        document.addEventListener('fullscreenchange', s, false);
    }

    if (error) {
        document.addEventListener('fullscreenerror', e, false);
    }

    if (element.requestFullscreen) {
        element.requestFullscreen(Element.ALLOW_KEYBOARD_INPUT);
    } else {
        error();
    }
};

Application.prototype.disableFullscreen = function (success) {
    // #ifdef DEBUG
    console.warn('DEPRECATED: pc.Application#disableFullscreen is deprecated. Use the Fullscreen API directly.');
    // #endif

    // success callback
    var s = function () {
        success();
        document.removeEventListener('fullscreenchange', s);
    };

    if (success) {
        document.addEventListener('fullscreenchange', s, false);
    }

    document.exitFullscreen();
};

Object.defineProperty(CameraComponent.prototype, "node", {
    get: function () {
        // #ifdef DEBUG
        console.warn("DEPRECATED: pc.CameraComponent#node is deprecated. Use pc.CameraComponent#entity instead.");
        // #endif
        return this.entity;
    }
});

Object.defineProperty(LightComponent.prototype, "enable", {
    get: function () {
        // #ifdef DEBUG
        console.warn("DEPRECATED: pc.LightComponent#enable is deprecated. Use pc.LightComponent#enabled instead.");
        // #endif
        return this.enabled;
    },
    set: function (value) {
        // #ifdef DEBUG
        console.warn("DEPRECATED: pc.LightComponent#enable is deprecated. Use pc.LightComponent#enabled instead.");
        // #endif
        this.enabled = value;
    }
});

ModelComponent.prototype.setVisible = function (visible) {
    // #ifdef DEBUG
    console.warn("DEPRECATED: pc.ModelComponent#setVisible is deprecated. Use pc.ModelComponent#enabled instead.");
    // #endif
    this.enabled = visible;
};

Object.defineProperty(RigidBodyComponent.prototype, "bodyType", {
    get: function () {
        // #ifdef DEBUG
        console.warn('DEPRECATED: pc.RigidBodyComponent#bodyType is deprecated. Use pc.RigidBodyComponent#type instead.');
        // #endif
        return this.type;
    },
    set: function (type) {
        // #ifdef DEBUG
        console.warn('DEPRECATED: pc.RigidBodyComponent#bodyType is deprecated. Use pc.RigidBodyComponent#type instead.');
        // #endif
        this.type = type;
    }
});

RigidBodyComponent.prototype.syncBodyToEntity = function () {
    // #ifdef DEBUG
    console.warn('pc.RigidBodyComponent#syncBodyToEntity is not public API and should not be used.');
    // #endif
    this._updateDynamic();
};

RigidBodyComponentSystem.prototype.setGravity = function () {
    // #ifdef DEBUG
    console.warn('DEPRECATED: pc.RigidBodyComponentSystem#setGravity is deprecated. Use pc.RigidBodyComponentSystem#gravity instead.');
    // #endif

    if (arguments.length === 1) {
        this.gravity.copy(arguments[0]);
    } else {
        this.gravity.set(arguments[0], arguments[1], arguments[2]);
    }
};
