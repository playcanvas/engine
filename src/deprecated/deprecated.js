import { Debug } from '../core/debug.js';

import { Vec2 } from '../core/math/vec2.js';
import { Vec3 } from '../core/math/vec3.js';
import { Vec4 } from '../core/math/vec4.js';
import { math } from '../core/math/math.js';

import {
    BLENDMODE_CONSTANT, BLENDMODE_ONE_MINUS_CONSTANT,
    PIXELFORMAT_LA8, PIXELFORMAT_RGB565, PIXELFORMAT_RGBA5551, PIXELFORMAT_RGBA4, PIXELFORMAT_RGB8, PIXELFORMAT_RGBA8,
    PIXELFORMAT_SRGB8, PIXELFORMAT_SRGBA8,
    TEXTURETYPE_DEFAULT, TEXTURETYPE_RGBM, TEXTURETYPE_SWIZZLEGGGR,
    SHADERLANGUAGE_GLSL
} from '../platform/graphics/constants.js';
import { drawQuadWithShader } from '../scene/graphics/quad-render-utils.js';
import { GraphicsDevice } from '../platform/graphics/graphics-device.js';
import { LayerComposition } from '../scene/composition/layer-composition.js';
import { RenderTarget } from '../platform/graphics/render-target.js';
import { Texture } from '../platform/graphics/texture.js';
import { VertexFormat } from '../platform/graphics/vertex-format.js';
import { BlendState } from '../platform/graphics/blend-state.js';
import { DepthState } from '../platform/graphics/depth-state.js';

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

// MATH

Vec2.prototype.scale = Vec2.prototype.mulScalar;

Vec3.prototype.scale = Vec3.prototype.mulScalar;

Vec4.prototype.scale = Vec4.prototype.mulScalar;

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
    Debug.deprecated('pc.createSphere is deprecated. Use \'pc.Mesh.fromGeometry(device, new SphereGeometry(options);\' format instead.');
    return Mesh.fromGeometry(device, new SphereGeometry(opts));
}

export function createPlane(device, opts) {
    Debug.deprecated('pc.createPlane is deprecated. Use \'pc.Mesh.fromGeometry(device, new PlaneGeometry(options);\' format instead.');
    return Mesh.fromGeometry(device, new PlaneGeometry(opts));
}

export function createBox(device, opts) {
    Debug.deprecated('pc.createBox is deprecated. Use \'pc.Mesh.fromGeometry(device, new BoxGeometry(options);\' format instead.');
    return Mesh.fromGeometry(device, new BoxGeometry(opts));
}

export function createTorus(device, opts) {
    Debug.deprecated('pc.createTorus is deprecated. Use \'pc.Mesh.fromGeometry(device, new TorusGeometry(options);\' format instead.');
    return Mesh.fromGeometry(device, new TorusGeometry(opts));
}

export function createCapsule(device, opts) {
    Debug.deprecated('pc.createCapsule is deprecated. Use \'pc.Mesh.fromGeometry(device, new CapsuleGeometry(options);\' format instead.');
    return Mesh.fromGeometry(device, new CapsuleGeometry(opts));
}

export function createCone(device, opts) {
    Debug.deprecated('pc.createCone is deprecated. Use \'pc.Mesh.fromGeometry(device, new ConeGeometry(options);\' format instead.');
    return Mesh.fromGeometry(device, new ConeGeometry(opts));
}

export function createCylinder(device, opts) {
    Debug.deprecated('pc.createCylinder is deprecated. Use \'pc.Mesh.fromGeometry(device, new CylinderGeometry(options);\' format instead.');
    return Mesh.fromGeometry(device, new CylinderGeometry(opts));
}

export function createMesh(device, positions, opts = {}) {
    Debug.deprecated('pc.createMesh is deprecated. Use \'pc.Mesh.fromGeometry(device, new Geometry();\' format instead.');

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

    Debug.deprecated('pc.drawFullscreenQuad is deprecated. When used as part of PostEffect, use PostEffect#drawQuad instead.');

    // convert rect in normalized space to viewport in pixel space
    let viewport;
    if (rect) {
        const w = target ? target.width : device.width;
        const h = target ? target.height : device.height;
        viewport = _viewport.set(rect.x * w, rect.y * h, rect.z * w, rect.w * h);
    }

    drawQuadWithShader(device, target, shader, viewport);
}

// Note: This was never public interface, but has been used in external scripts
Object.defineProperties(RenderTarget.prototype, {
    _glFrameBuffer: {
        get: function () {
            Debug.deprecated('pc.RenderTarget#_glFrameBuffer is deprecated. Use pc.RenderTarget.impl#_glFrameBuffer instead.');
            return this.impl._glFrameBuffer;
        },
        set: function (rgbm) {
            Debug.deprecated('pc.RenderTarget#_glFrameBuffer is deprecated. Use pc.RenderTarget.impl#_glFrameBuffer instead.');
        }
    }
});

Object.defineProperty(VertexFormat, 'defaultInstancingFormat', {
    get: function () {
        Debug.assert('pc.VertexFormat.defaultInstancingFormat is deprecated, use pc.VertexFormat.getDefaultInstancingFormat(graphicsDevice).');
        return null;
    }
});

Object.defineProperties(Texture.prototype, {
    rgbm: {
        get: function () {
            Debug.deprecated('pc.Texture#rgbm is deprecated. Use pc.Texture#type instead.');
            return this.type === TEXTURETYPE_RGBM;
        },
        set: function (rgbm) {
            Debug.deprecated('pc.Texture#rgbm is deprecated. Use pc.Texture#type instead.');
            this.type = rgbm ? TEXTURETYPE_RGBM : TEXTURETYPE_DEFAULT;
        }
    },

    swizzleGGGR: {
        get: function () {
            Debug.deprecated('pc.Texture#swizzleGGGR is deprecated. Use pc.Texture#type instead.');
            return this.type === TEXTURETYPE_SWIZZLEGGGR;
        },
        set: function (swizzleGGGR) {
            Debug.deprecated('pc.Texture#swizzleGGGR is deprecated. Use pc.Texture#type instead.');
            this.type = swizzleGGGR ? TEXTURETYPE_SWIZZLEGGGR : TEXTURETYPE_DEFAULT;
        }
    },

    _glTexture: {
        get: function () {
            Debug.deprecated('pc.Texture#_glTexture is no longer available, use Use pc.Texture.impl._glTexture instead.');
            return this.impl._glTexture;
        }
    }
});

Object.defineProperty(GraphicsDevice.prototype, 'boneLimit', {
    get: function () {
        Debug.deprecated('pc.GraphicsDevice#boneLimit is deprecated and the limit has been removed.');
        return 1024;
    }
});

Object.defineProperty(GraphicsDevice.prototype, 'webgl2', {
    get: function () {
        Debug.deprecated('pc.GraphicsDevice#webgl2 is deprecated, use pc.GraphicsDevice#isWebGL2 instead.');
        return this.isWebGL2;
    }
});

Object.defineProperty(GraphicsDevice.prototype, 'textureFloatHighPrecision', {
    get: function () {
        Debug.deprecated('pc.GraphicsDevice#textureFloatHighPrecision is deprecated and always returns true.');
        return true;
    }
});

Object.defineProperty(GraphicsDevice.prototype, 'extBlendMinmax', {
    get: function () {
        Debug.deprecated('pc.GraphicsDevice#extBlendMinmax is deprecated as it is always true.');
        return true;
    }
});

Object.defineProperty(GraphicsDevice.prototype, 'extTextureHalfFloat', {
    get: function () {
        Debug.deprecated('pc.GraphicsDevice#extTextureHalfFloat is deprecated as it is always true.');
        return true;
    }
});

Object.defineProperty(GraphicsDevice.prototype, 'extTextureLod', {
    get: function () {
        Debug.deprecated('pc.GraphicsDevice#extTextureLod is deprecated as it is always true.');
        return true;
    }
});

Object.defineProperty(GraphicsDevice.prototype, 'textureHalfFloatFilterable', {
    get: function () {
        Debug.deprecated('pc.GraphicsDevice#textureHalfFloatFilterable is deprecated as it is always true.');
        return true;
    }
});

Object.defineProperty(GraphicsDevice.prototype, 'supportsMrt', {
    get: function () {
        Debug.deprecated('pc.GraphicsDevice#supportsMrt is deprecated as it is always true.');
        return true;
    }
});

Object.defineProperty(GraphicsDevice.prototype, 'supportsVolumeTextures', {
    get: function () {
        Debug.deprecated('pc.GraphicsDevice#supportsVolumeTextures is deprecated as it is always true.');
        return true;
    }
});

Object.defineProperty(GraphicsDevice.prototype, 'supportsInstancing', {
    get: function () {
        Debug.deprecated('pc.GraphicsDevice#supportsInstancing is deprecated as it is always true.');
        return true;
    }
});

Object.defineProperty(GraphicsDevice.prototype, 'textureHalfFloatUpdatable', {
    get: function () {
        Debug.deprecated('pc.GraphicsDevice#textureHalfFloatUpdatable is deprecated as it is always true.');
        return true;
    }
});

Object.defineProperty(GraphicsDevice.prototype, 'extTextureFloat', {
    get: function () {
        Debug.deprecated('pc.GraphicsDevice#extTextureFloat is deprecated as it is always true');
        return true;
    }
});

Object.defineProperty(GraphicsDevice.prototype, 'extStandardDerivatives', {
    get: function () {
        Debug.deprecated('pc.GraphicsDevice#extStandardDerivatives is deprecated as it is always true.');
        return true;
    }
});

BlendState.DEFAULT = Object.freeze(new BlendState());

const _tempBlendState = new BlendState();
const _tempDepthState = new DepthState();

GraphicsDevice.prototype.setBlendFunction = function (blendSrc, blendDst) {
    Debug.deprecated('pc.GraphicsDevice#setBlendFunction is deprecated, use pc.GraphicsDevice.setBlendState instead.');
    const currentBlendState = this.blendState;
    _tempBlendState.copy(currentBlendState);
    _tempBlendState.setColorBlend(currentBlendState.colorOp, blendSrc, blendDst);
    _tempBlendState.setAlphaBlend(currentBlendState.alphaOp, blendSrc, blendDst);
    this.setBlendState(_tempBlendState);
};

GraphicsDevice.prototype.setBlendFunctionSeparate = function (blendSrc, blendDst, blendSrcAlpha, blendDstAlpha) {
    Debug.deprecated('pc.GraphicsDevice#setBlendFunctionSeparate is deprecated, use pc.GraphicsDevice.setBlendState instead.');
    const currentBlendState = this.blendState;
    _tempBlendState.copy(currentBlendState);
    _tempBlendState.setColorBlend(currentBlendState.colorOp, blendSrc, blendDst);
    _tempBlendState.setAlphaBlend(currentBlendState.alphaOp, blendSrcAlpha, blendDstAlpha);
    this.setBlendState(_tempBlendState);
};

GraphicsDevice.prototype.setBlendEquation = function (blendEquation) {
    Debug.deprecated('pc.GraphicsDevice#setBlendEquation is deprecated, use pc.GraphicsDevice.setBlendState instead.');
    const currentBlendState = this.blendState;
    _tempBlendState.copy(currentBlendState);
    _tempBlendState.setColorBlend(blendEquation, currentBlendState.colorSrcFactor, currentBlendState.colorDstFactor);
    _tempBlendState.setAlphaBlend(blendEquation, currentBlendState.alphaSrcFactor, currentBlendState.alphaDstFactor);
    this.setBlendState(_tempBlendState);
};

GraphicsDevice.prototype.setBlendEquationSeparate = function (blendEquation, blendAlphaEquation) {
    Debug.deprecated('pc.GraphicsDevice#setBlendEquationSeparate is deprecated, use pc.GraphicsDevice.setBlendState instead.');
    const currentBlendState = this.blendState;
    _tempBlendState.copy(currentBlendState);
    _tempBlendState.setColorBlend(blendEquation, currentBlendState.colorSrcFactor, currentBlendState.colorDstFactor);
    _tempBlendState.setAlphaBlend(blendAlphaEquation, currentBlendState.alphaSrcFactor, currentBlendState.alphaDstFactor);
    this.setBlendState(_tempBlendState);
};

GraphicsDevice.prototype.setColorWrite = function (redWrite, greenWrite, blueWrite, alphaWrite) {
    Debug.deprecated('pc.GraphicsDevice#setColorWrite is deprecated, use pc.GraphicsDevice.setBlendState instead.');
    const currentBlendState = this.blendState;
    _tempBlendState.copy(currentBlendState);
    _tempBlendState.setColorWrite(redWrite, greenWrite, blueWrite, alphaWrite);
    this.setBlendState(_tempBlendState);
};

GraphicsDevice.prototype.getBlending = function () {
    return this.blendState.blend;
};

GraphicsDevice.prototype.setBlending = function (blending) {
    Debug.deprecated('pc.GraphicsDevice#setBlending is deprecated, use pc.GraphicsDevice.setBlendState instead.');
    _tempBlendState.copy(this.blendState);
    _tempBlendState.blend = blending;
    this.setBlendState(_tempBlendState);
};

GraphicsDevice.prototype.setDepthWrite = function (write) {
    Debug.deprecated('pc.GraphicsDevice#setDepthWrite is deprecated, use pc.GraphicsDevice.setDepthState instead.');
    _tempDepthState.copy(this.depthState);
    _tempDepthState.write = write;
    this.setDepthState(_tempDepthState);
};

GraphicsDevice.prototype.setDepthFunc = function (func) {
    Debug.deprecated('pc.GraphicsDevice#setDepthFunc is deprecated, use pc.GraphicsDevice.setDepthState instead.');
    _tempDepthState.copy(this.depthState);
    _tempDepthState.func = func;
    this.setDepthState(_tempDepthState);
};

GraphicsDevice.prototype.setDepthTest = function (test) {
    Debug.deprecated('pc.GraphicsDevice#setDepthTest is deprecated, use pc.GraphicsDevice.setDepthState instead.');
    _tempDepthState.copy(this.depthState);
    _tempDepthState.test = test;
    this.setDepthState(_tempDepthState);
};

GraphicsDevice.prototype.getCullMode = function () {
    return this.cullMode;
};

// SCENE

export const Key = AnimationKey;
export const Node = AnimationNode;

export const LitOptions = LitShaderOptions;

// deprecated access to global shader chunks
export const shaderChunks = new Proxy({}, {
    get(target, prop) {
        Debug.deprecated(`Using pc.shaderChunks to access global shader chunks is deprecated. Use pc.ShaderChunks.get instead, for example: pc.ShaderChunks.get(this.app.graphicsDevice, pc.SHADERLANGUAGE_GLSL).get('${prop}');`);
        return ShaderChunks.get(getApplication().graphicsDevice, SHADERLANGUAGE_GLSL).get(prop);
    },
    set(target, prop, value) {
        Debug.deprecated(`Using pc.shaderChunks to override global shader chunks is deprecated. Use pc.ShaderChunks.get instead, for example: pc.ShaderChunks.get(this.app.graphicsDevice, pc.SHADERLANGUAGE_GLSL).set('${prop}');`);
        ShaderChunks.get(getApplication().graphicsDevice, SHADERLANGUAGE_GLSL).set(prop, value);
        return true;
    }
});

Object.defineProperty(Scene.prototype, 'defaultMaterial', {
    get: function () {
        Debug.deprecated('pc.Scene#defaultMaterial is deprecated.');
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
        Debug.deprecated('pc.LayerComposition#_meshInstances is deprecated.');
        return null;
    }
});

Object.defineProperty(Scene.prototype, 'drawCalls', {
    get: function () {
        Debug.deprecated('pc.Scene#drawCalls is deprecated and no longer provides mesh instances.');
        return null;
    }
});

// scene.skyboxPrefiltered**** are deprecated
['128', '64', '32', '16', '8', '4'].forEach((size, index) => {
    Object.defineProperty(Scene.prototype, `skyboxPrefiltered${size}`, {
        get: function () {
            Debug.deprecated(`pc.Scene#skyboxPrefiltered${size} is deprecated. Use pc.Scene#prefilteredCubemaps instead.`);
            return this._prefilteredCubemaps[index];
        },
        set: function (value) {
            Debug.deprecated(`pc.Scene#skyboxPrefiltered${size} is deprecated. Use pc.Scene#prefilteredCubemaps instead.`);
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

// A helper function to add deprecated set and get property on a class
function _removedClassProperty(targetClass, name, comment = '') {
    Object.defineProperty(targetClass.prototype, name, {
        set: function (value) {
            Debug.errorOnce(`${targetClass.name}#${name} has been removed. ${comment}`);
        },
        get: function () {
            Debug.errorOnce(`${targetClass.name}#${name} has been removed. ${comment}`);
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
    Debug.deprecated('pc.ForwardRenderer#renderComposition is deprecated. Use pc.AppBase.renderComposition instead.');
    getApplication().renderComposition(comp);
};

MeshInstance.prototype.syncAabb = function () {
    Debug.deprecated('pc.MeshInstance#syncAabb is deprecated.');
};

Morph.prototype.getTarget = function (index) {
    Debug.deprecated('pc.Morph#getTarget is deprecated. Use pc.Morph#targets instead.');

    return this.targets[index];
};

GraphNode.prototype.getChildren = function () {
    Debug.deprecated('pc.GraphNode#getChildren is deprecated. Use pc.GraphNode#children instead.');

    return this.children;
};

GraphNode.prototype.getName = function () {
    Debug.deprecated('pc.GraphNode#getName is deprecated. Use pc.GraphNode#name instead.');

    return this.name;
};

GraphNode.prototype.getPath = function () {
    Debug.deprecated('pc.GraphNode#getPath is deprecated. Use pc.GraphNode#path instead.');

    return this.path;
};

GraphNode.prototype.getRoot = function () {
    Debug.deprecated('pc.GraphNode#getRoot is deprecated. Use pc.GraphNode#root instead.');

    return this.root;
};

GraphNode.prototype.getParent = function () {
    Debug.deprecated('pc.GraphNode#getParent is deprecated. Use pc.GraphNode#parent instead.');

    return this.parent;
};

GraphNode.prototype.setName = function (name) {
    Debug.deprecated('pc.GraphNode#setName is deprecated. Use pc.GraphNode#name instead.');

    this.name = name;
};

Object.defineProperty(Material.prototype, 'shader', {
    set: function (value) {
        Debug.deprecated('pc.Material#shader is deprecated, use pc.ShaderMaterial instead.');
    },
    get: function () {
        Debug.deprecated('pc.Material#shader is deprecated, use pc.ShaderMaterial instead.');
        return null;
    }
});

// Note: this is used by the Editor
Object.defineProperty(Material.prototype, 'blend', {
    set: function (value) {
        Debug.deprecated('pc.Material#blend is deprecated, use pc.Material.blendState.');
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
        const sign = Math.sign(Math.cos(this.anisotropyRotation * math.DEG_TO_RAD * 2));
        return this.anisotropyIntensity * sign;
    },
    set: function (value) {
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
            Debug.deprecated(`pc.StandardMaterial#${oldName} is deprecated. Use pc.StandardMaterial#${newName} instead.`);
            return this[newName];
        },
        set: function (value) {
            Debug.deprecated(`pc.StandardMaterial#${oldName} is deprecated. Use pc.StandardMaterial#${newName} instead.`);
            this[newName] = value;
        }
    });
}

function _deprecateTint(name) {
    Object.defineProperty(StandardMaterial.prototype, name, {
        get: function () {
            Debug.deprecated(`pc.StandardMaterial#${name} is deprecated, and the behaviour is as if ${name} was always true`);
            return true;
        },
        set: function (value) {
            Debug.deprecated(`pc.StandardMaterial#${name} is deprecated, and the behaviour is as if ${name} was always true`);
        }
    });
}

_deprecateTint('sheenTint');
_deprecateTint('diffuseTint');
_deprecateTint('emissiveTint');
_deprecateTint('ambientTint');

_defineAlias('specularTint', 'specularMapTint');
_defineAlias('aoVertexColor', 'aoMapVertexColor');
_defineAlias('diffuseVertexColor', 'diffuseMapVertexColor');
_defineAlias('specularVertexColor', 'specularMapVertexColor');
_defineAlias('emissiveVertexColor', 'emissiveMapVertexColor');
_defineAlias('metalnessVertexColor', 'metalnessMapVertexColor');
_defineAlias('glossVertexColor', 'glossMapVertexColor');
_defineAlias('opacityVertexColor', 'opacityMapVertexColor');
_defineAlias('lightVertexColor', 'lightMapVertexColor');

_defineAlias('sheenGloss', 'sheenGlossiess');
_defineAlias('clearCoatGloss', 'clearCostGlossiness');

function _defineOption(name, newName) {
    if (name !== 'pass') {
        Object.defineProperty(StandardMaterialOptions.prototype, name, {
            get: function () {
                Debug.deprecated(`Getting pc.Options#${name} has been deprecated as the property has been moved to pc.Options.LitShaderOptions#${newName || name}.`);
                return this.litOptions[newName || name];
            },
            set: function (value) {
                Debug.deprecated(`Setting pc.Options#${name} has been deprecated as the property has been moved to pc.Options.LitShaderOptions#${newName || name}.`);
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
    Debug.deprecated('pc.AssetRegistry#getAssetById is deprecated. Use pc.AssetRegistry#get instead.');
    return this.get(id);
};

// XR

Object.defineProperty(XrInputSource.prototype, 'ray', {
    get: function () {
        Debug.deprecated('pc.XrInputSource#ray is deprecated. Use pc.XrInputSource#getOrigin and pc.XrInputSource#getDirection instead.');
        return this._rayLocal;
    }
});

Object.defineProperty(XrInputSource.prototype, 'position', {
    get: function () {
        Debug.deprecated('pc.XrInputSource#position is deprecated. Use pc.XrInputSource#getLocalPosition instead.');
        return this._localPosition;
    }
});

Object.defineProperty(XrInputSource.prototype, 'rotation', {
    get: function () {
        Debug.deprecated('pc.XrInputSource#rotation is deprecated. Use pc.XrInputSource#getLocalRotation instead.');
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
    Debug.deprecated('pc.AppBase#isFullscreen is deprecated. Use the Fullscreen API directly.');

    return !!document.fullscreenElement;
};

AppBase.prototype.enableFullscreen = function (element, success, error) {
    Debug.deprecated('pc.AppBase#enableFullscreen is deprecated. Use the Fullscreen API directly.');

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
    Debug.deprecated('pc.AppBase#disableFullscreen is deprecated. Use the Fullscreen API directly.');

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
    Debug.deprecated('pc.AppBase#getSceneUrl is deprecated. Use pc.AppBase#scenes and pc.SceneRegistry#find instead.');
    const entry = this.scenes.find(name);
    if (entry) {
        return entry.url;
    }
    return null;
};

AppBase.prototype.loadScene = function (url, callback) {
    Debug.deprecated('pc.AppBase#loadScene is deprecated. Use pc.AppBase#scenes and pc.SceneRegistry#loadScene instead.');
    this.scenes.loadScene(url, callback);
};

AppBase.prototype.loadSceneHierarchy = function (url, callback) {
    Debug.deprecated('pc.AppBase#loadSceneHierarchy is deprecated. Use pc.AppBase#scenes and pc.SceneRegistry#loadSceneHierarchy instead.');
    this.scenes.loadSceneHierarchy(url, callback);
};

AppBase.prototype.loadSceneSettings = function (url, callback) {
    Debug.deprecated('pc.AppBase#loadSceneSettings is deprecated. Use pc.AppBase#scenes and pc.SceneRegistry#loadSceneSettings instead.');
    this.scenes.loadSceneSettings(url, callback);
};

ModelComponent.prototype.setVisible = function (visible) {
    Debug.deprecated('pc.ModelComponent#setVisible is deprecated. Use pc.ModelComponent#enabled instead.');
    this.enabled = visible;
};

Object.defineProperty(RigidBodyComponent.prototype, 'bodyType', {
    get: function () {
        Debug.deprecated('pc.RigidBodyComponent#bodyType is deprecated. Use pc.RigidBodyComponent#type instead.');
        return this.type;
    },
    set: function (type) {
        Debug.deprecated('pc.RigidBodyComponent#bodyType is deprecated. Use pc.RigidBodyComponent#type instead.');
        this.type = type;
    }
});

RigidBodyComponent.prototype.syncBodyToEntity = function () {
    Debug.deprecated('pc.RigidBodyComponent#syncBodyToEntity is not public API and should not be used.');
    this._updateDynamic();
};

RigidBodyComponentSystem.prototype.setGravity = function () {
    Debug.deprecated('pc.RigidBodyComponentSystem#setGravity is deprecated. Use pc.RigidBodyComponentSystem#gravity instead.');

    if (arguments.length === 1) {
        this.gravity.copy(arguments[0]);
    } else {
        this.gravity.set(arguments[0], arguments[1], arguments[2]);
    }
};
