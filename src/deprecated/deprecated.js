import { revision, version } from '../core/core.js';
import { string } from '../core/string.js';
import { Timer, now } from '../core/time.js';

import { math } from '../math/math.js';
import { Color } from '../math/color.js';
import { Mat4 } from '../math/mat4.js';
import { Vec2 } from '../math/vec2.js';
import { Vec3 } from '../math/vec3.js';
import { Vec4 } from '../math/vec4.js';

import { BoundingBox } from '../shape/bounding-box.js';
import { BoundingSphere } from '../shape/bounding-sphere.js';
import { Frustum } from '../shape/frustum.js';
import { Plane } from '../shape/plane.js';

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
} from '../graphics/constants.js';
import { drawQuadWithShader } from '../graphics/simple-post-effect.js';
import { programlib } from '../graphics/program-lib/program-lib.js';
import { shaderChunks } from '../graphics/program-lib/chunks/chunks.js';
import { GraphicsDevice } from '../graphics/graphics-device.js';
import { IndexBuffer } from '../graphics/index-buffer.js';
import { createFullscreenQuad, drawFullscreenQuad, PostEffect } from '../graphics/post-effect.js';
import { PostEffectQueue } from '../framework/components/camera/post-effect-queue.js';
import { ProgramLibrary } from '../graphics/program-library.js';
import { RenderTarget } from '../graphics/render-target.js';
import { ScopeId } from '../graphics/scope-id.js';
import { Shader } from '../graphics/shader.js';
import { ShaderInput } from '../graphics/shader-input.js';
import { Texture } from '../graphics/texture.js';
import { VertexBuffer } from '../graphics/vertex-buffer.js';
import { VertexFormat } from '../graphics/vertex-format.js';
import { VertexIterator } from '../graphics/vertex-iterator.js';

import { PROJECTION_ORTHOGRAPHIC, PROJECTION_PERSPECTIVE, LAYERID_IMMEDIATE, LINEBATCH_OVERLAY } from '../scene/constants.js';
import { calculateTangents, createBox, createCapsule, createCone, createCylinder, createMesh, createPlane, createSphere, createTorus } from '../scene/procedural.js';
import { partitionSkin } from '../scene/skin-partition.js';
import { BasicMaterial } from '../scene/materials/basic-material.js';
import { DepthMaterial } from '../scene/materials/depth-material.js';
import { ForwardRenderer } from '../scene/renderer/forward-renderer.js';
import { GraphNode } from '../scene/graph-node.js';
import { Material } from '../scene/materials/material.js';
import { Mesh } from '../scene/mesh.js';
import { Morph } from '../scene/morph.js';
import { MeshInstance, Command } from '../scene/mesh-instance.js';
import { Model } from '../scene/model.js';
import { ParticleEmitter } from '../scene/particle-system/particle-emitter.js';
import { Picker } from '../scene/picker.js';
import { Scene } from '../scene/scene.js';
import { Skin } from '../scene/skin.js';
import { SkinInstance } from '../scene/skin-instance.js';
import { StandardMaterial } from '../scene/materials/standard-material.js';
import { Batch } from '../scene/batching/batch.js';
import { DefaultMaterial } from '../scene/materials/default-material.js';

import { Animation, Key, Node } from '../animation/animation.js';
import { Skeleton } from '../animation/skeleton.js';

import { Channel } from '../audio/channel.js';
import { Channel3d } from '../audio/channel3d.js';
import { Listener } from '../sound/listener.js';
import { Sound } from '../sound/sound.js';
import { SoundManager } from '../sound/manager.js';

import { AssetRegistry } from '../asset/asset-registry.js';

import { XrInputSource } from '../xr/xr-input-source.js';

import { Controller } from '../input/controller.js';
import { ElementInput } from '../input/element-input.js';
import { GamePads } from '../input/game-pads.js';
import { Keyboard } from '../input/keyboard.js';
import { KeyboardEvent } from '../input/keyboard-event.js';
import { Mouse } from '../input/mouse.js';
import { MouseEvent } from '../input/mouse-event.js';
import { TouchDevice } from '../input/touch-device.js';
import { getTouchTargetCoords, Touch, TouchEvent } from '../input/touch-event.js';

import { FILLMODE_FILL_WINDOW, FILLMODE_KEEP_ASPECT, FILLMODE_NONE, RESOLUTION_AUTO, RESOLUTION_FIXED } from '../framework/constants.js';
import { Application } from '../framework/application.js';
import { getApplication } from '../framework/globals.js';
import { CameraComponent } from '../framework/components/camera/component.js';
import { Component } from '../framework/components/component.js';
import { ComponentSystem } from '../framework/components/system.js';
import { Entity } from '../framework/entity.js';
import { LightComponent } from '../framework/components/light/component.js';
import { ModelComponent } from '../framework/components/model/component.js';
import { RenderComponent } from '../framework/components/render/component.js';
import {
    BODYFLAG_KINEMATIC_OBJECT, BODYFLAG_NORESPONSE_OBJECT, BODYFLAG_STATIC_OBJECT,
    BODYSTATE_ACTIVE_TAG, BODYSTATE_DISABLE_DEACTIVATION, BODYSTATE_DISABLE_SIMULATION, BODYSTATE_ISLAND_SLEEPING, BODYSTATE_WANTS_DEACTIVATION,
    BODYTYPE_DYNAMIC, BODYTYPE_KINEMATIC, BODYTYPE_STATIC
} from '../framework/components/rigid-body/constants.js';
import { RigidBodyComponent } from '../framework/components/rigid-body/component.js';
import { RigidBodyComponentSystem } from '../framework/components/rigid-body/system.js';
import { basisInitialize } from '../resources/basis.js';
import { EventHandler } from '../core/event-handler.js';
import { Asset } from '../asset/asset.js';
import { DeprecatedLog } from './deprecated-log.js';

// CORE

export const log = {
    write: function (text) {
        DeprecatedLog.log("DEPRECATED: pc.log.write is deprecated. Use console.log instead.");
        console.log(text);
    },

    open: function () {
        DeprecatedLog.log("DEPRECATED: pc.log.open is deprecated. Use console.log instead.");
        log.write("Powered by PlayCanvas " + version + " " + revision);
    },

    info: function (text) {
        DeprecatedLog.log("DEPRECATED: pc.log.info is deprecated. Use console.info instead.");
        console.info("INFO:    " + text);
    },

    debug: function (text) {
        DeprecatedLog.log("DEPRECATED: pc.log.debug is deprecated. Use console.debug instead.");
        console.debug("DEBUG:   " + text);
    },

    error: function (text) {
        DeprecatedLog.log("DEPRECATED: pc.log.error is deprecated. Use console.error instead.");
        console.error("ERROR:   " + text);
    },

    warning: function (text) {
        DeprecatedLog.log("DEPRECATED: pc.log.warning is deprecated. Use console.warn instead.");
        console.warn("WARNING: " + text);
    },

    alert: function (text) {
        DeprecatedLog.log("DEPRECATED: pc.log.alert is deprecated. Use alert instead.");
        log.write("ALERT:   " + text);
        alert(text); // eslint-disable-line no-alert
    },

    assert: function (condition, text) {
        DeprecatedLog.log("DEPRECATED: pc.log.assert is deprecated. Use a conditional plus console.log instead.");
        if (condition === false) {
            log.write("ASSERT:  " + text);
        }
    }
};

string.endsWith = function (s, subs) {
    DeprecatedLog.log("DEPRECATED: pc.string.endsWith is deprecated. Use String#endsWith instead.");
    return s.endsWith(subs);
};

string.startsWith = function (s, subs) {
    DeprecatedLog.log("DEPRECATED: pc.string.startsWith is deprecated. Use String#startsWith instead.");
    return s.startsWith(subs);
};

export const time = {
    now: now,
    Timer: Timer
};

Object.defineProperty(Color.prototype, "data", {
    get: function () {
        DeprecatedLog.log('pc.Color#data is not public API and should not be used. Access color components via their individual properties.');
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
        DeprecatedLog.log('pc.Color#data3 is not public API and should not be used. Access color components via their individual properties.');
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
    const Temp = function () {};
    const Func = function (arg1, arg2, arg3, arg4, arg5, arg6, arg7, arg8) {
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
    DeprecatedLog.log('pc.makeArray is not public API and should not be used. Use Array.prototype.slice.call instead.');
    return Array.prototype.slice.call(arr);
}

// MATH

math.INV_LOG2 = Math.LOG2E;

math.intToBytes = math.intToBytes32;
math.bytesToInt = math.bytesToInt32;

Object.defineProperty(Vec2.prototype, "data", {
    get: function () {
        DeprecatedLog.log('pc.Vec2#data is not public API and should not be used. Access vector components via their individual properties.');
        if (!this._data) {
            this._data = new Float32Array(2);
        }
        this._data[0] = this.x;
        this._data[1] = this.y;
        return this._data;
    }
});

Vec2.prototype.scale = Vec2.prototype.mulScalar;

Object.defineProperty(Vec3.prototype, "data", {
    get: function () {
        DeprecatedLog.log('pc.Vec3#data is not public API and should not be used. Access vector components via their individual properties.');
        if (!this._data) {
            this._data = new Float32Array(3);
        }
        this._data[0] = this.x;
        this._data[1] = this.y;
        this._data[2] = this.z;
        return this._data;
    }
});

Vec3.prototype.scale = Vec3.prototype.mulScalar;

Object.defineProperty(Vec4.prototype, "data", {
    get: function () {
        DeprecatedLog.log('pc.Vec4#data is not public API and should not be used. Access vector components via their individual properties.');
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

Vec4.prototype.scale = Vec4.prototype.mulScalar;

// SHAPE

export const shape = {
    Aabb: BoundingBox,
    Sphere: BoundingSphere,
    Plane: Plane
};

BoundingSphere.prototype.intersectRay = BoundingSphere.prototype.intersectsRay;

Frustum.prototype.update = function (projectionMatrix, viewMatrix) {
    DeprecatedLog.log('DEPRECATED: pc.Frustum#update is deprecated. Use pc.Frustum#setFromMat4 instead.');

    const viewProj = new Mat4();

    viewProj.mul2(projectionMatrix, viewMatrix);

    this.setFromMat4(viewProj);
};

// GRAPHICS

export const ELEMENTTYPE_INT8 = TYPE_INT8;
export const ELEMENTTYPE_UINT8 = TYPE_UINT8;
export const ELEMENTTYPE_INT16 = TYPE_INT16;
export const ELEMENTTYPE_UINT16 = TYPE_UINT16;
export const ELEMENTTYPE_INT32 = TYPE_INT32;
export const ELEMENTTYPE_UINT32 = TYPE_UINT32;
export const ELEMENTTYPE_FLOAT32 = TYPE_FLOAT32;

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

export const gfx = {
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

export const posteffect = {
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
            DeprecatedLog.log("DEPRECATED: pc.Texture#rgbm is deprecated. Use pc.Texture#type instead.");
            return this.type === TEXTURETYPE_RGBM;
        },
        set: function (rgbm) {
            DeprecatedLog.log("DEPRECATED: pc.Texture#rgbm is deprecated. Use pc.Texture#type instead.");
            this.type = rgbm ? TEXTURETYPE_RGBM : TEXTURETYPE_DEFAULT;
        }
    },

    swizzleGGGR: {
        get: function () {
            DeprecatedLog.log("DEPRECATED: pc.Texture#swizzleGGGR is deprecated. Use pc.Texture#type instead.");
            return this.type === TEXTURETYPE_SWIZZLEGGGR;
        },
        set: function (swizzleGGGR) {
            DeprecatedLog.log("DEPRECATED: pc.Texture#swizzleGGGR is deprecated. Use pc.Texture#type instead.");
            this.type = swizzleGGGR ? TEXTURETYPE_SWIZZLEGGGR : TEXTURETYPE_DEFAULT;
        }
    }
});

// SCENE

export const PhongMaterial = StandardMaterial;

export const scene = {
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

Object.defineProperty(Scene.prototype, 'defaultMaterial', {
    get: function () {
        DeprecatedLog.log('DEPRECATED: pc.Scene#defaultMaterial is deprecated.');
        return DefaultMaterial.get(getApplication().graphicsDevice);
    }
});

Object.defineProperty(Batch.prototype, 'model', {
    get: function () {
        DeprecatedLog.log('DEPRECATED: pc.Batch#model is deprecated. Use pc.Batch#mesInstance to access batched mesh instead.');
        return null;
    }
});

Morph.prototype.getTarget = function (index) {
    DeprecatedLog.log('DEPRECATED: pc.Morph#getTarget is deprecated. Use pc.Morph#targets instead.');

    return this.targets[index];
};

GraphNode.prototype._dirtify = function (local) {
    DeprecatedLog.log('DEPRECATED: pc.GraphNode#_dirtify is deprecated. Use pc.GraphNode#_dirtifyLocal or _dirtifyWorld respectively instead.');
    if (local)
        this._dirtifyLocal();
    else
        this._dirtifyWorld();
};

GraphNode.prototype.addLabel = function (label) {
    DeprecatedLog.log('DEPRECATED: pc.GraphNode#addLabel is deprecated. Use pc.GraphNode#tags instead.');

    this._labels[label] = true;
};

GraphNode.prototype.getLabels = function () {
    DeprecatedLog.log('DEPRECATED: pc.GraphNode#getLabels is deprecated. Use pc.GraphNode#tags instead.');

    return Object.keys(this._labels);
};

GraphNode.prototype.hasLabel = function (label) {
    DeprecatedLog.log('DEPRECATED: pc.GraphNode#hasLabel is deprecated. Use pc.GraphNode#tags instead.');

    return !!this._labels[label];
};

GraphNode.prototype.removeLabel = function (label) {
    DeprecatedLog.log('DEPRECATED: pc.GraphNode#removeLabel is deprecated. Use pc.GraphNode#tags instead.');

    delete this._labels[label];
};

GraphNode.prototype.findByLabel = function (label, results = []) {
    DeprecatedLog.log('DEPRECATED: pc.GraphNode#findByLabel is deprecated. Use pc.GraphNode#tags instead.');

    if (this.hasLabel(label)) {
        results.push(this);
    }

    for (let i = 0; i < this._children.length; ++i) {
        results = this._children[i].findByLabel(label, results);
    }

    return results;
};

GraphNode.prototype.getChildren = function () {
    DeprecatedLog.log('DEPRECATED: pc.GraphNode#getChildren is deprecated. Use pc.GraphNode#children instead.');

    return this.children;
};

GraphNode.prototype.getName = function () {
    DeprecatedLog.log('DEPRECATED: pc.GraphNode#getName is deprecated. Use pc.GraphNode#name instead.');

    return this.name;
};

GraphNode.prototype.getPath = function () {
    DeprecatedLog.log('DEPRECATED: pc.GraphNode#getPath is deprecated. Use pc.GraphNode#path instead.');

    return this.path;
};

GraphNode.prototype.getRoot = function () {
    DeprecatedLog.log('DEPRECATED: pc.GraphNode#getRoot is deprecated. Use pc.GraphNode#root instead.');

    return this.root;
};

GraphNode.prototype.getParent = function () {
    DeprecatedLog.log('DEPRECATED: pc.GraphNode#getParent is deprecated. Use pc.GraphNode#parent instead.');

    return this.parent;
};

GraphNode.prototype.setName = function (name) {
    DeprecatedLog.log('DEPRECATED: pc.GraphNode#setName is deprecated. Use pc.GraphNode#name instead.');

    this.name = name;
};

Material.prototype.getName = function () {
    DeprecatedLog.log('DEPRECATED: pc.Material#getName is deprecated. Use pc.Material#name instead.');
    return this.name;
};

Material.prototype.setName = function (name) {
    DeprecatedLog.log('DEPRECATED: pc.Material#setName is deprecated. Use pc.Material#name instead.');
    this.name = name;
};

Material.prototype.getShader = function () {
    DeprecatedLog.log('DEPRECATED: pc.Material#getShader is deprecated. Use pc.Material#shader instead.');
    return this.shader;
};

Material.prototype.setShader = function (shader) {
    DeprecatedLog.log('DEPRECATED: pc.Material#setShader is deprecated. Use pc.Material#shader instead.');
    this.shader = shader;
};

// ANIMATION

export const anim = {
    Animation: Animation,
    Key: Key,
    Node: Node,
    Skeleton: Skeleton
};

Animation.prototype.getDuration = function () {
    DeprecatedLog.log('DEPRECATED: pc.Animation#getDuration is deprecated. Use pc.Animation#duration instead.');
    return this.duration;
};

Animation.prototype.getName = function () {
    DeprecatedLog.log('DEPRECATED: pc.Animation#getName is deprecated. Use pc.Animation#name instead.');
    return this.name;
};

Animation.prototype.getNodes = function () {
    DeprecatedLog.log('DEPRECATED: pc.Animation#getNodes is deprecated. Use pc.Animation#nodes instead.');
    return this.nodes;
};

Animation.prototype.setDuration = function (duration) {
    DeprecatedLog.log('DEPRECATED: pc.Animation#setDuration is deprecated. Use pc.Animation#duration instead.');
    this.duration = duration;
};

Animation.prototype.setName = function (name) {
    DeprecatedLog.log('DEPRECATED: pc.Animation#setName is deprecated. Use pc.Animation#name instead.');
    this.name = name;
};

Skeleton.prototype.getAnimation = function () {
    DeprecatedLog.log('DEPRECATED: pc.Skeleton#getAnimation is deprecated. Use pc.Skeleton#animation instead.');
    return this.animation;
};

Skeleton.prototype.getCurrentTime = function () {
    DeprecatedLog.log('DEPRECATED: pc.Skeleton#getCurrentTime is deprecated. Use pc.Skeleton#currentTime instead.');
    return this.currentTime;
};

Skeleton.prototype.getLooping = function () {
    DeprecatedLog.log('DEPRECATED: pc.Skeleton#getLooping is deprecated. Use pc.Skeleton#looping instead.');
    return this.looping;
};

Skeleton.prototype.getNumNodes = function () {
    DeprecatedLog.log('DEPRECATED: pc.Skeleton#getNumNodes is deprecated. Use pc.Skeleton#numNodes instead.');
    return this.numNodes;
};

Skeleton.prototype.setAnimation = function (animation) {
    DeprecatedLog.log('DEPRECATED: pc.Skeleton#setAnimation is deprecated. Use pc.Skeleton#animation instead.');
    this.animation = animation;
};

Skeleton.prototype.setCurrentTime = function (time) {
    DeprecatedLog.log('DEPRECATED: pc.Skeleton#setCurrentTime is deprecated. Use pc.Skeleton#currentTime instead.');
    this.currentTime = time;
};

Skeleton.prototype.setLooping = function (looping) {
    DeprecatedLog.log('DEPRECATED: pc.Skeleton#setLooping is deprecated. Use pc.Skeleton#looping instead.');
    this.looping = looping;
};

// SOUND

export const audio = {
    AudioManager: SoundManager,
    Channel: Channel,
    Channel3d: Channel3d,
    Listener: Listener,
    Sound: Sound
};

SoundManager.prototype.getListener = function () {
    DeprecatedLog.log('DEPRECATED: pc.SoundManager#getListener is deprecated. Use pc.SoundManager#listener instead.');
    return this.listener;
};

SoundManager.prototype.getVolume = function () {
    DeprecatedLog.log('DEPRECATED: pc.SoundManager#getVolume is deprecated. Use pc.SoundManager#volume instead.');
    return this.volume;
};

SoundManager.prototype.setVolume = function (volume) {
    DeprecatedLog.log('DEPRECATED: pc.SoundManager#setVolume is deprecated. Use pc.SoundManager#volume instead.');
    this.volume = volume;
};

// ASSET

export const asset = {
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
    DeprecatedLog.log("DEPRECATED: pc.AssetRegistry#getAssetById is deprecated. Use pc.AssetRegistry#get instead.");
    return this.get(id);
};

// XR

Object.defineProperty(XrInputSource.prototype, 'ray', {
    get: function () {
        DeprecatedLog.log('DEPRECATED: pc.XrInputSource#ray is deprecated. Use pc.XrInputSource#getOrigin and pc.XrInputSource#getDirection instead.');
        return this._rayLocal;
    }
});

Object.defineProperty(XrInputSource.prototype, 'position', {
    get: function () {
        DeprecatedLog.log('DEPRECATED: pc.XrInputSource#position is deprecated. Use pc.XrInputSource#getLocalPosition instead.');
        return this._localPosition;
    }
});

Object.defineProperty(XrInputSource.prototype, 'rotation', {
    get: function () {
        DeprecatedLog.log('DEPRECATED: pc.XrInputSource#rotation is deprecated. Use pc.XrInputSource#getLocalRotation instead.');
        return this._localRotation;
    }
});

// INPUT

export const input = {
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

export const fw = {
    Application: Application,
    Component: Component,
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
    DeprecatedLog.log('DEPRECATED: pc.Application#isFullscreen is deprecated. Use the Fullscreen API directly.');

    return !!document.fullscreenElement;
};

Application.prototype.enableFullscreen = function (element, success, error) {
    DeprecatedLog.log('DEPRECATED: pc.Application#enableFullscreen is deprecated. Use the Fullscreen API directly.');

    element = element || this.graphicsDevice.canvas;

    // success callback
    const s = function () {
        success();
        document.removeEventListener('fullscreenchange', s);
    };

    // error callback
    const e = function () {
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
    DeprecatedLog.log('DEPRECATED: pc.Application#disableFullscreen is deprecated. Use the Fullscreen API directly.');

    // success callback
    const s = function () {
        success();
        document.removeEventListener('fullscreenchange', s);
    };

    if (success) {
        document.addEventListener('fullscreenchange', s, false);
    }

    document.exitFullscreen();
};

Application.prototype.getSceneUrl = function (name) {
    DeprecatedLog.log("DEPRECATED: pc.Application#getSceneUrl is deprecated. Use pc.Application#scenes and pc.SceneRegistry#find instead.");
    const entry = this.scenes.find(name);
    if (entry) {
        return entry.url;
    }
    return null;
};

Application.prototype.loadScene = function (url, callback) {
    DeprecatedLog.log("DEPRECATED: pc.Application#loadScene is deprecated. Use pc.Application#scenes and pc.SceneRegistry#loadScene instead.");
    this.scenes.loadScene(url, callback);
};

Application.prototype.loadSceneHierarchy = function (url, callback) {
    DeprecatedLog.log("DEPRECATED: pc.Application#loadSceneHierarchy is deprecated. Use pc.Application#scenes and pc.SceneRegistry#loadSceneHierarchy instead.");
    this.scenes.loadSceneHierarchy(url, callback);
};

Application.prototype.loadSceneSettings = function (url, callback) {
    DeprecatedLog.log("DEPRECATED: pc.Application#loadSceneSettings is deprecated. Use pc.Application#scenes and pc.SceneRegistry#loadSceneSettings instead.");
    this.scenes.loadSceneSettings(url, callback);
};

Application.prototype.renderMeshInstance = function (meshInstance, options) {
    DeprecatedLog.log("DEPRECATED: pc.Application.renderMeshInstance is deprecated. Use pc.Application.drawMeshInstance.");
    const layer = options?.layer ? options.layer : this._getDefaultDrawLayer();
    this._immediate.drawMesh(null, null, null, meshInstance, layer);
};

Application.prototype.renderMesh = function (mesh, material, matrix, options) {
    DeprecatedLog.log("DEPRECATED: pc.Application.renderMesh is deprecated. Use pc.Application.drawMesh.");
    const layer = options?.layer ? options.layer : this._getDefaultDrawLayer();
    this._immediate.drawMesh(material, matrix, mesh, null, layer);
};

Application.prototype._addLines = function (positions, colors, options) {
    const layer = (options && options.layer) ? options.layer : this.scene.layers.getLayerById(LAYERID_IMMEDIATE);
    const depthTest = (options && options.depthTest !== undefined) ? options.depthTest : true;

    const batch = this._immediate.getBatch(layer, depthTest);
    batch.addLines(positions, colors);
};

Application.prototype.renderLine = function (start, end, color) {

    DeprecatedLog.log("DEPRECATED: pc.Application.renderLine is deprecated. Use pc.Application.drawLine.");

    let endColor = color;
    let options;

    const arg3 = arguments[3];
    const arg4 = arguments[4];

    if (arg3 instanceof Color) {
        // passed in end color
        endColor = arg3;

        if (typeof arg4 === 'number') {
            // compatibility: convert linebatch id into options
            if (arg4 === LINEBATCH_OVERLAY) {
                options = {
                    layer: this.scene.layers.getLayerById(LAYERID_IMMEDIATE),
                    depthTest: false
                };
            } else {
                options = {
                    layer: this.scene.layers.getLayerById(LAYERID_IMMEDIATE),
                    depthTest: true
                };
            }
        } else {
            // use passed in options
            options = arg4;
        }
    } else if (typeof arg3 === 'number') {
        endColor = color;

        // compatibility: convert linebatch id into options
        if (arg3 === LINEBATCH_OVERLAY) {
            options = {
                layer: this.scene.layers.getLayerById(LAYERID_IMMEDIATE),
                depthTest: false
            };
        } else {
            options = {
                layer: this.scene.layers.getLayerById(LAYERID_IMMEDIATE),
                depthTest: true
            };
        }
    } else if (arg3) {
        // options passed in
        options = arg3;
    }

    this._addLines([start, end], [color, endColor], options);
};

Application.prototype.renderLines = function (position, color, options) {

    DeprecatedLog.log("DEPRECATED: pc.Application.renderLines is deprecated. Use pc.Application.drawLines.");

    if (!options) {
        // default option
        options = {
            layer: this.scene.layers.getLayerById(LAYERID_IMMEDIATE),
            depthTest: true
        };
    } else if (typeof options === 'number') {
        // backwards compatibility, LINEBATCH_OVERLAY lines have depthtest disabled
        if (options === LINEBATCH_OVERLAY) {
            options = {
                layer: this.scene.layers.getLayerById(LAYERID_IMMEDIATE),
                depthTest: false
            };
        } else {
            options = {
                layer: this.scene.layers.getLayerById(LAYERID_IMMEDIATE),
                depthTest: true
            };
        }
    }

    const multiColor = !!color.length;
    if (multiColor) {
        if (position.length !== color.length) {
            console.error("renderLines: position/color arrays have different lengths");
            return;
        }
    }
    if (position.length % 2 !== 0) {
        console.error("renderLines: array length is not divisible by 2");
        return;
    }
    this._addLines(position, color, options);
};

Object.defineProperty(CameraComponent.prototype, "node", {
    get: function () {
        DeprecatedLog.log("DEPRECATED: pc.CameraComponent#node is deprecated. Use pc.CameraComponent#entity instead.");
        return this.entity;
    }
});

Object.defineProperty(LightComponent.prototype, "enable", {
    get: function () {
        DeprecatedLog.log("DEPRECATED: pc.LightComponent#enable is deprecated. Use pc.LightComponent#enabled instead.");
        return this.enabled;
    },
    set: function (value) {
        DeprecatedLog.log("DEPRECATED: pc.LightComponent#enable is deprecated. Use pc.LightComponent#enabled instead.");
        this.enabled = value;
    }
});

ModelComponent.prototype.setVisible = function (visible) {
    DeprecatedLog.log("DEPRECATED: pc.ModelComponent#setVisible is deprecated. Use pc.ModelComponent#enabled instead.");
    this.enabled = visible;
};

Object.defineProperty(ModelComponent.prototype, "aabb", {
    get: function () {
        DeprecatedLog.log('DEPRECATED: pc.ModelComponent#aabb is deprecated. Use pc.ModelComponent#customAabb instead - which expects local space AABB instead of a world space AABB.');
        return null;
    },
    set: function (type) {
        DeprecatedLog.log('DEPRECATED: pc.ModelComponent#aabb is deprecated. Use pc.ModelComponent#customAabb instead - which expects local space AABB instead of a world space AABB.');
    }
});

Object.defineProperty(RenderComponent.prototype, "aabb", {
    get: function () {
        DeprecatedLog.log('DEPRECATED: pc.RenderComponent#aabb is deprecated. Use pc.RenderComponent#customAabb instead - which expects local space AABB instead of a world space AABB.');
        return null;
    },
    set: function (type) {
        DeprecatedLog.log('DEPRECATED: pc.RenderComponent#aabb is deprecated. Use pc.RenderComponent#customAabb instead - which expects local space AABB instead of a world space AABB.');
    }
});

Object.defineProperty(RigidBodyComponent.prototype, "bodyType", {
    get: function () {
        DeprecatedLog.log('DEPRECATED: pc.RigidBodyComponent#bodyType is deprecated. Use pc.RigidBodyComponent#type instead.');
        return this.type;
    },
    set: function (type) {
        DeprecatedLog.log('DEPRECATED: pc.RigidBodyComponent#bodyType is deprecated. Use pc.RigidBodyComponent#type instead.');
        this.type = type;
    }
});

RigidBodyComponent.prototype.syncBodyToEntity = function () {
    DeprecatedLog.log('pc.RigidBodyComponent#syncBodyToEntity is not public API and should not be used.');
    this._updateDynamic();
};

RigidBodyComponentSystem.prototype.setGravity = function () {
    DeprecatedLog.log('DEPRECATED: pc.RigidBodyComponentSystem#setGravity is deprecated. Use pc.RigidBodyComponentSystem#gravity instead.');

    if (arguments.length === 1) {
        this.gravity.copy(arguments[0]);
    } else {
        this.gravity.set(arguments[0], arguments[1], arguments[2]);
    }
};


export function basisSetDownloadConfig(glueUrl, wasmUrl, fallbackUrl) {
    DeprecatedLog.log('DEPRECATED: pc.basisSetDownloadConfig is deprecated. Use pc.basisInitialize instead.');
    basisInitialize({
        glueUrl: glueUrl,
        wasmUrl: wasmUrl,
        fallbackUrl: fallbackUrl,
        lazyInit: true
    });
}

export class AssetListLoader extends EventHandler {
    constructor(assetList, assetRegistry) {
        DeprecatedLog.log('DEPRECATED: pc.AssetListLoader is deprecated.');

        super();

        this._assets = [];
        this._registry = assetRegistry;
        this._loaded = false;
        this._count = 0; // running count of successfully loaded assets
        this._total = 0; // total assets loader is expecting to load
        this._failed = []; // list of assets that failed to load

        this._waitingAssets = [];

        if (assetList.length && assetList[0] instanceof Asset) {
            // list of pc.Asset
            this._assets = assetList;
        } else {
            // list of Asset IDs
            for (let i = 0; i < assetList.length; i++) {
                const asset = assetRegistry.get(assetList[i]);
                if (asset) {
                    this._assets.push(asset);
                } else {
                    this._waitForAsset(assetList[i]);
                    this._total++;
                }

            }
        }
    }

    destroy() {
        DeprecatedLog.log('DEPRECATED: pc.AssetListLoader is deprecated.');

        // remove any outstanding listeners
        this._registry.off("load", this._onLoad);
        this._registry.off("error", this._onError);

        this._waitingAssets.forEach((id) => {
            this._registry.off("add:" + id, this._onAddAsset);
        });

        this.off("progress");
        this.off("load");
    }

    /**
     * @private
     * @function
     * @name AssetListLoader#load
     * @description Start loading asset list, call done() when all assets have loaded or failed to load.
     * @param {Function} done - Callback called when all assets in the list are loaded. Passed (err, failed) where err is the undefined if no errors are encountered and failed contains a list of assets that failed to load.
     * @param {object} [scope] - Scope to use when calling callback.
     *
     */
    load(done, scope) {
        DeprecatedLog.log('DEPRECATED: pc.AssetListLoader is deprecated.');

        this._count = 0;
        this._failed = [];
        this._callback = done;
        this._scope = scope;

        this._registry.on("load", this._onLoad, this);
        this._registry.on("error", this._onError, this);

        for (let i = 0, l = this._assets.length; i < l; i++) {
            const asset = this._assets[i];

            if (!asset.loading && !asset.loaded) {
                this._registry.load(asset);
                this._total++;
            }
        }
    }

    /**
     * @private
     * @function
     * @name AssetListLoader#ready
     * @param {Function} done - Callback called when all assets in the list are loaded.
     * @param {object} [scope] - Scope to use when calling callback.
     */
    ready(done, scope) {
        DeprecatedLog.log('DEPRECATED: pc.AssetListLoader is deprecated.');

        scope = scope || this;

        if (this._loaded) {
            done.call(scope, this._assets);
        } else {
            this.once("load", function (assets) {
                done.call(scope, assets);
            });
        }
    }

    // called when all assets are loaded
    _loadingComplete() {
        this._loaded = true;
        this._registry.off("load", this._onLoad, this);
        this._registry.off("error", this._onError, this);

        if (this._failed && this._failed.length) {
            if (this._callback) {
                this._callback.call(this._scope, "Failed to load some assets", this._failed);
            }
            this.fire("error", this._failed);
        } else {
            if (this._callback) {
                this._callback.call(this._scope);
            }
            this.fire("load", this._assets);
        }
    }

    // called when an (any) asset is loaded
    _onLoad(asset) {
        // check this is an asset we care about
        if (this._assets.indexOf(asset) >= 0) {
            this._count++;
            this.fire("progress", asset);
        }

        if (this._count === this._total) {
            // call next tick because we want
            // this to be fired after any other
            // asset load events
            setTimeout(() => {
                this._loadingComplete(this._failed);
            }, 0);
        }
    }

    // called when an asset fails to load
    _onError(err, asset) {
        // check this is an asset we care about
        if (this._assets.indexOf(asset) >= 0) {
            this._count++;
            this._failed.push(asset);
        }

        if (this._count === this._total) {
            // call next tick because we want
            // this to be fired after any other
            // asset load events
            setTimeout(() => {
                this._loadingComplete(this._failed);
            }, 0);
        }
    }

    // called when a expected asset is added to the asset registry
    _onAddAsset(asset) {
        // remove from waiting list
        const index = this._waitingAssets.indexOf(asset);
        if (index >= 0) {
            this._waitingAssets.splice(index, 1);
        }

        this._assets.push(asset);
        for (let i = 0, l = this._assets.length; i < l; i++) {
            asset = this._assets[i];

            if (!asset.loading && !asset.loaded) {
                this._registry.load(asset);
            }
        }
    }

    _waitForAsset(assetId) {
        this._waitingAssets.push(assetId);
        this._registry.once('add:' + assetId, this._onAddAsset, this);
    }
}
