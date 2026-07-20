import { Debug } from '../core/debug.js';

import { Vec4 } from '../core/math/vec4.js';
import { math } from '../core/math/math.js';

import {
    BLENDMODE_CONSTANT, BLENDMODE_ONE_MINUS_CONSTANT,
    PIXELFORMAT_LA8, PIXELFORMAT_RGB565, PIXELFORMAT_RGBA5551, PIXELFORMAT_RGBA4, PIXELFORMAT_RGB8, PIXELFORMAT_RGBA8,
    PIXELFORMAT_SRGB8, PIXELFORMAT_SRGBA8,
    SHADERLANGUAGE_GLSL
} from '../platform/graphics/constants.js';
import { drawQuadWithShader } from '../scene/graphics/quad-render-utils.js';
import { LayerComposition } from '../scene/composition/layer-composition.js';

import { AnimationKey, AnimationNode } from '../scene/animation/animation.js';
import { Geometry } from '../scene/geometry/geometry.js';
import { CylinderGeometry } from '../scene/geometry/cylinder-geometry.js';
import { BoxGeometry } from '../scene/geometry/box-geometry.js';
import { CapsuleGeometry } from '../scene/geometry/capsule-geometry.js';
import { ConeGeometry } from '../scene/geometry/cone-geometry.js';
import { PlaneGeometry } from '../scene/geometry/plane-geometry.js';
import { SphereGeometry } from '../scene/geometry/sphere-geometry.js';
import { TorusGeometry } from '../scene/geometry/torus-geometry.js';
import { ForwardRenderer } from '../scene/renderer/forward-renderer.js';
import { GraphNode } from '../scene/graph-node.js';
import { Material } from '../scene/materials/material.js';
import { Mesh } from '../scene/mesh.js';
import { Morph } from '../scene/morph.js';
import { MeshInstance } from '../scene/mesh-instance.js';
import { Scene } from '../scene/scene.js';
import { StandardMaterial } from '../scene/materials/standard-material.js';
import { getDefaultMaterial } from '../scene/materials/default-material.js';
import { StandardMaterialOptions } from '../scene/materials/standard-material-options.js';
import { LitShaderOptions } from '../scene/shader-lib/programs/lit-shader-options.js';
import { Layer } from '../scene/layer.js';

import { AssetRegistry } from '../framework/asset/asset-registry.js';

import { XrInputSource } from '../framework/xr/xr-input-source.js';

import { ElementInput } from '../framework/input/element-input.js';
import { MouseEvent } from '../platform/input/mouse-event.js';

import { AppBase } from '../framework/app-base.js';
import { getApplication } from '../framework/globals.js';
import { ModelComponent } from '../framework/components/model/component.js';
import {
    BODYFLAG_KINEMATIC_OBJECT, BODYFLAG_NORESPONSE_OBJECT, BODYFLAG_STATIC_OBJECT,
    BODYSTATE_ACTIVE_TAG, BODYSTATE_DISABLE_DEACTIVATION, BODYSTATE_DISABLE_SIMULATION, BODYSTATE_ISLAND_SLEEPING, BODYSTATE_WANTS_DEACTIVATION,
    BODYTYPE_DYNAMIC, BODYTYPE_KINEMATIC, BODYTYPE_STATIC
} from '../framework/components/rigid-body/constants.js';
import { RigidBodyComponent } from '../framework/components/rigid-body/component.js';
import { RigidBodyComponentSystem } from '../framework/components/rigid-body/system.js';
import { CameraComponent } from '../framework/components/camera/component.js';
import { ShaderChunks } from '../scene/shader-lib/shader-chunks.js';

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

Object.defineProperty(Scene.prototype, 'defaultMaterial', {
    get: function () {
        Debug.deprecated('Scene#defaultMaterial is deprecated.');
        return getDefaultMaterial(getApplication().graphicsDevice);
    }
});

Object.defineProperty(Scene.prototype, 'fogColor', {
    set: function (value) {
        Debug.deprecated('Scene#fogColor is deprecated. Use Scene#fog.color instead.');
        this.fog.color = value;
    },
    get: function () {
        Debug.deprecated('Scene#fogColor is deprecated. Use Scene#fog.color instead.');
        return this.fog.color;
    }
});

Object.defineProperty(Scene.prototype, 'fogEnd', {
    set: function (value) {
        Debug.deprecated('Scene#fogEnd is deprecated. Use Scene#fog.end instead.');
        this.fog.end = value;
    },
    get: function () {
        Debug.deprecated('Scene#fogEnd is deprecated. Use Scene#fog.end instead.');
        return this.fog.end;
    }
});

Object.defineProperty(Scene.prototype, 'fogStart', {
    set: function (value) {
        Debug.deprecated('Scene#fogStart is deprecated. Use Scene#fog.start instead.');
        this.fog.start = value;
    },
    get: function () {
        Debug.deprecated('Scene#fogStart is deprecated. Use Scene#fog.start instead.');
        return this.fog.start;
    }
});

Object.defineProperty(Scene.prototype, 'fogDensity', {
    set: function (value) {
        Debug.deprecated('Scene#fogDensity is deprecated. Use Scene#fog.density instead.');
        this.fog.density = value;
    },
    get: function () {
        Debug.deprecated('Scene#fogDensity is deprecated. Use Scene#fog.density instead.');
        return this.fog.density;
    }
});

Object.defineProperty(Scene.prototype, 'toneMapping', {
    set: function (value) {
        Debug.removed('Scene#toneMapping is removed. Use CameraComponent#toneMapping instead.');
    },
    get: function () {
        Debug.removed('Scene#toneMapping is removed. Use CameraComponent#toneMapping instead.');
        return undefined;
    }
});

Object.defineProperty(Scene.prototype, 'gammaCorrection', {
    set: function (value) {
        Debug.removed('Scene#gammaCorrection is removed. Use CameraComponent#gammaCorrection instead.');
    },
    get: function () {
        Debug.removed('Scene#gammaCorrection is removed. Use CameraComponent#gammaCorrection instead.');
        return undefined;
    }
});

Object.defineProperty(Scene.prototype, 'rendering', {
    set: function (value) {
        Debug.removed('Scene#rendering is removed. Use Scene#fog or CameraComponent#gammaCorrection or CameraComponent#toneMapping instead.');
    },
    get: function () {
        Debug.removed('Scene#rendering is removed. Use Scene#fog or CameraComponent#gammaCorrection or CameraComponent#toneMapping instead.');
        return undefined;
    }
});

Object.defineProperty(LayerComposition.prototype, '_meshInstances', {
    get: function () {
        Debug.removed('LayerComposition#_meshInstances was removed.');
        return null;
    }
});

Object.defineProperty(Scene.prototype, 'drawCalls', {
    get: function () {
        Debug.removed('Scene#drawCalls was removed and no longer provides mesh instances.');
        return null;
    }
});

// scene.skyboxPrefiltered**** are deprecated
['128', '64', '32', '16', '8', '4'].forEach((size, index) => {
    Object.defineProperty(Scene.prototype, `skyboxPrefiltered${size}`, {
        get: function () {
            Debug.deprecated(`Scene#skyboxPrefiltered${size} is deprecated. Use Scene#prefilteredCubemaps instead.`);
            return this._prefilteredCubemaps[index];
        },
        set: function (value) {
            Debug.deprecated(`Scene#skyboxPrefiltered${size} is deprecated. Use Scene#prefilteredCubemaps instead.`);
            this._prefilteredCubemaps[index] = value;
            this.updateShaders = true;
        }
    });
});

Object.defineProperty(Scene.prototype, 'models', {
    get: function () {
        if (!this._models) {
            this._models = [];
        }
        return this._models;
    }
});

// A helper function to add a removed set and get property on a class
function _removedClassProperty(targetClass, name, comment = '') {
    Object.defineProperty(targetClass.prototype, name, {
        set: function (value) {
            Debug.removed(`${targetClass.name}#${name} was removed. ${comment}`);
        },
        get: function () {
            Debug.removed(`${targetClass.name}#${name} was removed. ${comment}`);
            return undefined;
        }
    });
}

_removedClassProperty(Layer, 'renderTarget');
_removedClassProperty(Layer, 'onPreCull');
_removedClassProperty(Layer, 'onPreRender');
_removedClassProperty(Layer, 'onPreRenderOpaque');
_removedClassProperty(Layer, 'onPreRenderTransparent');
_removedClassProperty(Layer, 'onPostCull');
_removedClassProperty(Layer, 'onPostRender');
_removedClassProperty(Layer, 'onPostRenderOpaque');
_removedClassProperty(Layer, 'onPostRenderTransparent');
_removedClassProperty(Layer, 'onDrawCall');
_removedClassProperty(Layer, 'layerReference');

_removedClassProperty(CameraComponent, 'onPreCull', 'Use Scene#EVENT_PRECULL event instead.');
_removedClassProperty(CameraComponent, 'onPostCull', 'Use Scene#EVENT_POSTCULL event instead.');
_removedClassProperty(CameraComponent, 'onPreRender', 'Use Scene#EVENT_PRERENDER event instead.');
_removedClassProperty(CameraComponent, 'onPostRender', 'Use Scene#EVENT_POSTRENDER event instead.');
_removedClassProperty(CameraComponent, 'onPreRenderLayer', 'Use Scene#EVENT_PRERENDER_LAYER event instead.');
_removedClassProperty(CameraComponent, 'onPostRenderLayer', 'Use Scene#EVENT_POSTRENDER_LAYER event instead.');

ForwardRenderer.prototype.renderComposition = function (comp) {
    Debug.deprecated('ForwardRenderer#renderComposition is deprecated. Use AppBase.renderComposition instead.');
    getApplication().renderComposition(comp);
};

MeshInstance.prototype.syncAabb = function () {
    Debug.removed('MeshInstance#syncAabb was removed.');
};

Morph.prototype.getTarget = function (index) {
    Debug.deprecated('Morph#getTarget is deprecated. Use Morph#targets instead.');

    return this.targets[index];
};

GraphNode.prototype.getChildren = function () {
    Debug.deprecated('GraphNode#getChildren is deprecated. Use GraphNode#children instead.');

    return this.children;
};

GraphNode.prototype.getName = function () {
    Debug.deprecated('GraphNode#getName is deprecated. Use GraphNode#name instead.');

    return this.name;
};

GraphNode.prototype.getPath = function () {
    Debug.deprecated('GraphNode#getPath is deprecated. Use GraphNode#path instead.');

    return this.path;
};

GraphNode.prototype.getRoot = function () {
    Debug.deprecated('GraphNode#getRoot is deprecated. Use GraphNode#root instead.');

    return this.root;
};

GraphNode.prototype.getParent = function () {
    Debug.deprecated('GraphNode#getParent is deprecated. Use GraphNode#parent instead.');

    return this.parent;
};

GraphNode.prototype.setName = function (name) {
    Debug.deprecated('GraphNode#setName is deprecated. Use GraphNode#name instead.');

    this.name = name;
};

Object.defineProperty(Material.prototype, 'shader', {
    set: function (value) {
        Debug.removed('Material#shader was removed. Use ShaderMaterial instead.');
    },
    get: function () {
        Debug.removed('Material#shader was removed. Use ShaderMaterial instead.');
        return null;
    }
});

// Note: this is used by the Editor
Object.defineProperty(Material.prototype, 'blend', {
    set: function (value) {
        Debug.deprecated('Material#blend is deprecated, use Material.blendState.');
        this.blendState.blend = value;
    },
    get: function () {
        return this.blendState.blend;
    }
});

// shininess (range 0..100) - maps to internal gloss value (range 0..1)
Object.defineProperty(StandardMaterial.prototype, 'shininess', {
    get: function () {
        return this.gloss * 100;
    },
    set: function (value) {
        this.gloss = value * 0.01;
    }
});

// useGammaTonemap was renamed to useTonemap. For now do not log a deprecated warning to make existing
// code work without warnings.
Object.defineProperty(StandardMaterial.prototype, 'useGammaTonemap', {
    get: function () {
        return this.useTonemap;
    },
    set: function (value) {
        this.useTonemap = value;
    }
});

Object.defineProperty(StandardMaterial.prototype, 'anisotropy', {
    get: function () {
        Debug.deprecated('StandardMaterial#anisotropy is deprecated. Use StandardMaterial#anisotropyIntensity and StandardMaterial#anisotropyRotation instead.');
        const sign = Math.sign(Math.cos(this.anisotropyRotation * math.DEG_TO_RAD * 2));
        return this.anisotropyIntensity * sign;
    },
    set: function (value) {
        Debug.deprecated('StandardMaterial#anisotropy is deprecated. Use StandardMaterial#anisotropyIntensity and StandardMaterial#anisotropyRotation instead.');
        this.anisotropyIntensity = Math.abs(value);
        if (value >= 0) {
            this.anisotropyRotation = 0;
        } else {
            this.anisotropyRotation = 90;
        }
    }
});

function _defineAlias(newName, oldName) {
    Object.defineProperty(StandardMaterial.prototype, oldName, {
        get: function () {
            Debug.deprecated(`StandardMaterial#${oldName} is deprecated. Use StandardMaterial#${newName} instead.`);
            return this[newName];
        },
        set: function (value) {
            Debug.deprecated(`StandardMaterial#${oldName} is deprecated. Use StandardMaterial#${newName} instead.`);
            this[newName] = value;
        }
    });
}

function _removeTint(name) {
    Object.defineProperty(StandardMaterial.prototype, name, {
        get: function () {
            Debug.removed(`StandardMaterial#${name} was removed, and the behaviour is as if ${name} was always true`);
            return true;
        },
        set: function (value) {
            Debug.removed(`StandardMaterial#${name} was removed, and the behaviour is as if ${name} was always true`);
        }
    });
}

_removeTint('sheenTint');
_removeTint('diffuseTint');
_removeTint('emissiveTint');
_removeTint('ambientTint');

_defineAlias('specularTint', 'specularMapTint');
_defineAlias('aoVertexColor', 'aoMapVertexColor');
_defineAlias('diffuseVertexColor', 'diffuseMapVertexColor');
_defineAlias('specularVertexColor', 'specularMapVertexColor');
_defineAlias('emissiveVertexColor', 'emissiveMapVertexColor');
_defineAlias('metalnessVertexColor', 'metalnessMapVertexColor');
_defineAlias('glossVertexColor', 'glossMapVertexColor');
_defineAlias('opacityVertexColor', 'opacityMapVertexColor');
_defineAlias('lightVertexColor', 'lightMapVertexColor');

_defineAlias('sheenGloss', 'sheenGlossiness');
_defineAlias('clearCoatGloss', 'clearCoatGlossiness');

function _defineOption(name, newName) {
    if (name !== 'pass') {
        Object.defineProperty(StandardMaterialOptions.prototype, name, {
            get: function () {
                Debug.deprecated(`Getting StandardMaterialOptions#${name} is deprecated. Use StandardMaterialOptions#litOptions.${newName || name} instead.`);
                return this.litOptions[newName || name];
            },
            set: function (value) {
                Debug.deprecated(`Setting StandardMaterialOptions#${name} is deprecated. Use StandardMaterialOptions#litOptions.${newName || name} instead.`);
                this.litOptions[newName || name] = value;
            }
        });
    }
}
_defineOption('refraction', 'useRefraction');

const tempOptions = new LitShaderOptions();
const litOptionProperties = Object.getOwnPropertyNames(tempOptions);
for (const litOption in litOptionProperties) {
    _defineOption(litOptionProperties[litOption]);
}

// ASSET

AssetRegistry.prototype.getAssetById = function (id) {
    Debug.deprecated('AssetRegistry#getAssetById is deprecated. Use AssetRegistry#get instead.');
    return this.get(id);
};

// XR

Object.defineProperty(XrInputSource.prototype, 'ray', {
    get: function () {
        Debug.deprecated('XrInputSource#ray is deprecated. Use XrInputSource#getOrigin and XrInputSource#getDirection instead.');
        return this._rayLocal;
    }
});

Object.defineProperty(XrInputSource.prototype, 'position', {
    get: function () {
        Debug.deprecated('XrInputSource#position is deprecated. Use XrInputSource#getLocalPosition instead.');
        return this._localPosition;
    }
});

Object.defineProperty(XrInputSource.prototype, 'rotation', {
    get: function () {
        Debug.deprecated('XrInputSource#rotation is deprecated. Use XrInputSource#getLocalRotation instead.');
        return this._localRotation;
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

AppBase.prototype.isFullscreen = function () {
    Debug.deprecated('AppBase#isFullscreen is deprecated. Use the Fullscreen API directly.');

    return !!document.fullscreenElement;
};

AppBase.prototype.enableFullscreen = function (element, success, error) {
    Debug.deprecated('AppBase#enableFullscreen is deprecated. Use the Fullscreen API directly.');

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

AppBase.prototype.disableFullscreen = function (success) {
    Debug.deprecated('AppBase#disableFullscreen is deprecated. Use the Fullscreen API directly.');

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

AppBase.prototype.getSceneUrl = function (name) {
    Debug.deprecated('AppBase#getSceneUrl is deprecated. Use AppBase#scenes and SceneRegistry#find instead.');
    const entry = this.scenes.find(name);
    if (entry) {
        return entry.url;
    }
    return null;
};

AppBase.prototype.loadScene = function (url, callback) {
    Debug.deprecated('AppBase#loadScene is deprecated. Use AppBase#scenes and SceneRegistry#loadScene instead.');
    this.scenes.loadScene(url, callback);
};

AppBase.prototype.loadSceneHierarchy = function (url, callback) {
    Debug.deprecated('AppBase#loadSceneHierarchy is deprecated. Use AppBase#scenes and SceneRegistry#loadSceneHierarchy instead.');
    this.scenes.loadSceneHierarchy(url, callback);
};

AppBase.prototype.loadSceneSettings = function (url, callback) {
    Debug.deprecated('AppBase#loadSceneSettings is deprecated. Use AppBase#scenes and SceneRegistry#loadSceneSettings instead.');
    this.scenes.loadSceneSettings(url, callback);
};

ModelComponent.prototype.setVisible = function (visible) {
    Debug.deprecated('ModelComponent#setVisible is deprecated. Use ModelComponent#enabled instead.');
    this.enabled = visible;
};

Object.defineProperty(RigidBodyComponent.prototype, 'bodyType', {
    get: function () {
        Debug.deprecated('RigidBodyComponent#bodyType is deprecated. Use RigidBodyComponent#type instead.');
        return this.type;
    },
    set: function (type) {
        Debug.deprecated('RigidBodyComponent#bodyType is deprecated. Use RigidBodyComponent#type instead.');
        this.type = type;
    }
});

RigidBodyComponent.prototype.syncBodyToEntity = function () {
    Debug.deprecated('RigidBodyComponent#syncBodyToEntity is not public API and should not be used.');
    this._updateDynamic();
};

RigidBodyComponentSystem.prototype.setGravity = function () {
    Debug.deprecated('RigidBodyComponentSystem#setGravity is deprecated. Use RigidBodyComponentSystem#gravity instead.');

    if (arguments.length === 1) {
        this.gravity.copy(arguments[0]);
    } else {
        this.gravity.set(arguments[0], arguments[1], arguments[2]);
    }
};
