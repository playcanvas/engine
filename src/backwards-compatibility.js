/**
 * @private
 * @deprecated
 * Implementation of inheritance for JavaScript objects
 * @example
 * // Class can access all of Base's function prototypes
 * Base = function () {}
 * Class = function () {}
 * Class = Class.extendsFrom(Base)
 * @param {Object} Super Superclass
 * @returns {Function} Subclass
 */
Function.prototype.extendsFrom = function (Super) {
    var Self, Func;
    var Temp = function () {};

    Self = this;
    Func = function () {
        Super.apply(this, arguments);
        Self.apply(this, arguments);
        this.constructor = Self;
    };
    Func._super = Super.prototype;
    Temp.prototype = Super.prototype;
    Func.prototype = new Temp();
    return Func;
};

// Continue to support the old engine namespaces
pc.anim = {
    Animation: pc.Animation,
    Key: pc.Key,
    Node: pc.Node,
    Skeleton: pc.Skeleton
};

pc.asset = {
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

pc.audio = {
    AudioManager: pc.SoundManager,
    Channel: pc.Channel,
    Channel3d: pc.Channel3d,
    Listener: pc.Listener,
    Sound: pc.Sound
};

pc.fw = {
    Application: pc.Application,
    Component: pc.Component,
    ComponentData: pc.ComponentData,
    ComponentSystem: pc.ComponentSystem,
    Entity: pc.Entity,
    FillMode: {
        NONE: pc.FILLMODE_NONE,
        FILL_WINDOW: pc.FILLMODE_FILL_WINDOW,
        KEEP_ASPECT: pc.FILLMODE_KEEP_ASPECT
    },
    ResolutionMode: {
        AUTO: pc.RESOLUTION_AUTO,
        FIXED: pc.RESOLUTION_FIXED
    }
};

Object.assign(pc.gfx, {
    drawQuadWithShader: pc.drawQuadWithShader,
    precalculatedTangents: pc.precalculatedTangents,
    programlib: pc.programlib,
    shaderChunks: pc.shaderChunks,
    ContextCreationError: pc.ContextCreationError,
    Device: pc.GraphicsDevice,
    IndexBuffer: pc.IndexBuffer,
    ProgramLibrary: pc.ProgramLibrary,
    RenderTarget: pc.RenderTarget,
    ScopeId: pc.ScopeId,
    Shader: pc.Shader,
    ShaderInput: pc.ShaderInput,
    Texture: pc.Texture,
    UnsupportedBrowserError: pc.UnsupportedBrowserError,
    VertexBuffer: pc.VertexBuffer,
    VertexFormat: pc.VertexFormat,
    VertexIterator: pc.VertexIterator
});

// Exceptions
(function () {
    function UnsupportedBrowserError(message) {
        this.name = "UnsupportedBrowserError";
        this.message = (message || "");
    }
    UnsupportedBrowserError.prototype = Error.prototype;

    function ContextCreationError(message) {
        this.name = "ContextCreationError";
        this.message = (message || "");
    }
    ContextCreationError.prototype = Error.prototype;

    pc.ContextCreationError = ContextCreationError;
    pc.UnsupportedBrowserError = UnsupportedBrowserError;
})();

Object.assign(pc.input, {
    getTouchTargetCoords: pc.getTouchTargetCoords,
    Controller: pc.Controller,
    GamePads: pc.GamePads,
    Keyboard: pc.Keyboard,
    KeyboardEvent: pc.KeyboardEvent,
    Mouse: pc.Mouse,
    MouseEvent: pc.MouseEvent,
    Touch: pc.Touch,
    TouchDevice: pc.TouchDevice,
    TouchEvent: pc.TouchEvent
});

/**
 * @private
 * @deprecated
 * @name pc.math.INV_LOG2
 * @description Inverse log 2. Use Math.LOG2E instead.
 * @type Number
 */
pc.math.INV_LOG2 = Math.LOG2E;

pc.math.intToBytes = pc.math.intToBytes32;
pc.math.bytesToInt = pc.math.bytesToInt32;

pc.posteffect = {
    createFullscreenQuad: pc.createFullscreenQuad,
    drawFullscreenQuad: pc.drawFullscreenQuad,
    PostEffect: pc.PostEffect,
    PostEffectQueue: pc.PostEffectQueue
};

Object.assign(pc.scene, {
    partitionSkin: pc.partitionSkin,
    procedural: {
        calculateTangents: pc.calculateTangents,
        createMesh: pc.createMesh,
        createTorus: pc.createTorus,
        createCylinder: pc.createCylinder,
        createCapsule: pc.createCapsule,
        createCone: pc.createCone,
        createSphere: pc.createSphere,
        createPlane: pc.createPlane,
        createBox: pc.createBox
    },
    BasicMaterial: pc.BasicMaterial,
    DepthMaterial: pc.DepthMaterial,
    ForwardRenderer: pc.ForwardRenderer,
    GraphNode: pc.GraphNode,
    Material: pc.Material,
    Command: pc.Command,
    Mesh: pc.Mesh,
    MeshInstance: pc.MeshInstance,
    Model: pc.Model,
    ParticleEmitter: pc.ParticleEmitter,
    PhongMaterial: pc.StandardMaterial,
    Picker: pc.Picker,
    PickMaterial: pc.PickMaterial,
    Projection: {
        ORTHOGRAPHIC: pc.PROJECTION_ORTHOGRAPHIC,
        PERSPECTIVE: pc.PROJECTION_PERSPECTIVE
    },
    Scene: pc.Scene,
    Skin: pc.Skin,
    SkinInstance: pc.SkinInstance
});

pc.shape = {
    Aabb: pc.BoundingBox,
    Sphere: pc.BoundingSphere,
    Plane: pc.Plane
};

pc.time = {
    now: pc.now,
    Timer: pc.Timer
};

pc.PhongMaterial = pc.StandardMaterial;

pc.BoundingSphere.prototype.intersectRay = pc.BoundingSphere.prototype.intersectsRay;

pc.ELEMENTTYPE_INT8 = pc.TYPE_INT8;
pc.ELEMENTTYPE_UINT8 = pc.TYPE_UINT8;
pc.ELEMENTTYPE_INT16 = pc.TYPE_INT16;
pc.ELEMENTTYPE_UINT16 = pc.TYPE_UINT16;
pc.ELEMENTTYPE_INT32 = pc.TYPE_INT32;
pc.ELEMENTTYPE_UINT32 = pc.TYPE_UINT32;
pc.ELEMENTTYPE_FLOAT32 = pc.TYPE_FLOAT32;

Object.defineProperty(pc.shaderChunks, "transformSkinnedVS", {
    get: function () {
        return "#define SKIN\n" + pc.shaderChunks.transformVS;
    }
});
