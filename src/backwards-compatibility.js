Object.assign(pc, function () {
    return {
        inherits: function (Self, Super) {
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
    };
}());

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

pc.string.startsWith = function (s, subs) {
    // #ifdef DEBUG
    console.warn("DEPRECATED: pc.string.startsWith is deprecated. Use String#startsWith instead.");
    // #endif
    return s.startsWith(subs);
};

pc.string.endsWith = function (s, subs) {
    // #ifdef DEBUG
    console.warn("DEPRECATED: pc.string.endsWith is deprecated. Use String#endsWith instead.");
    // #endif
    return s.endsWith(subs);
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

Object.defineProperty(pc.Vec2.prototype, "data", {
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

Object.defineProperty(pc.Vec3.prototype, "data", {
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

Object.defineProperty(pc.Vec4.prototype, "data", {
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

Object.defineProperty(pc.Color.prototype, "data", {
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

Object.defineProperty(pc.Color.prototype, "data3", {
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

pc.Application.prototype.isFullscreen = function () {
    // #ifdef DEBUG
    console.warn('DEPRECATED: pc.Application#isFullscreen is deprecated. Use the Fullscreen API directly.');
    // #endif

    return !!document.fullscreenElement;
};

pc.Application.prototype.enableFullscreen = function (element, success, error) {
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

pc.Application.prototype.disableFullscreen = function (success) {
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

pc.AssetRegistry.prototype.getAssetById = function (id) {
    // #ifdef DEBUG
    console.warn("DEPRECATED: pc.AssetRegistry#getAssetById is deprecated. Use pc.AssetRegistry#get instead.");
    // #endif
    return this.get(id);
};

pc.GraphNode.prototype._dirtify = function (local) {
    // #ifdef DEBUG
    console.warn('DEPRECATED: pc.GraphNode#_dirtify is deprecated. Use pc.GraphNode#_dirtifyLocal or _dirtifyWorld respectively instead.');
    // #endif
    if (local)
        this._dirtifyLocal();
    else
        this._dirtifyWorld();
};

pc.GraphNode.prototype.addLabel = function (label) {
    // #ifdef DEBUG
    console.warn('DEPRECATED: pc.GraphNode#addLabel is deprecated. Use pc.GraphNode#tags instead.');
    // #endif

    this._labels[label] = true;
};

pc.GraphNode.prototype.getLabels = function () {
    // #ifdef DEBUG
    console.warn('DEPRECATED: pc.GraphNode#getLabels is deprecated. Use pc.GraphNode#tags instead.');
    // #endif

    return Object.keys(this._labels);
};

pc.GraphNode.prototype.hasLabel = function (label) {
    // #ifdef DEBUG
    console.warn('DEPRECATED: pc.GraphNode#hasLabel is deprecated. Use pc.GraphNode#tags instead.');
    // #endif

    return !!this._labels[label];
};

pc.GraphNode.prototype.removeLabel = function (label) {
    // #ifdef DEBUG
    console.warn('DEPRECATED: pc.GraphNode#removeLabel is deprecated. Use pc.GraphNode#tags instead.');
    // #endif

    delete this._labels[label];
};

pc.GraphNode.prototype.findByLabel = function (label, results) {
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

pc.GraphNode.prototype.getChildren = function () {
    // #ifdef DEBUG
    console.warn('DEPRECATED: pc.GraphNode#getChildren is deprecated. Use pc.GraphNode#children instead.');
    // #endif

    return this.children;
};

pc.GraphNode.prototype.getName = function () {
    // #ifdef DEBUG
    console.warn('DEPRECATED: pc.GraphNode#getName is deprecated. Use pc.GraphNode#name instead.');
    // #endif

    return this.name;
};

pc.GraphNode.prototype.getPath = function () {
    // #ifdef DEBUG
    console.warn('DEPRECATED: pc.GraphNode#getPath is deprecated. Use pc.GraphNode#path instead.');
    // #endif

    return this.path;
};

pc.GraphNode.prototype.getRoot = function () {
    // #ifdef DEBUG
    console.warn('DEPRECATED: pc.GraphNode#getRoot is deprecated. Use pc.GraphNode#root instead.');
    // #endif

    return this.root;
};

pc.GraphNode.prototype.getParent = function () {
    // #ifdef DEBUG
    console.warn('DEPRECATED: pc.GraphNode#getParent is deprecated. Use pc.GraphNode#parent instead.');
    // #endif

    return this.parent;
};

pc.GraphNode.prototype.setName = function (name) {
    // #ifdef DEBUG
    console.warn('DEPRECATED: pc.GraphNode#setName is deprecated. Use pc.GraphNode#name instead.');
    // #endif

    this.name = name;
};

pc.Material.prototype.getName = function () {
    // #ifdef DEBUG
    console.warn('DEPRECATED: pc.Material#getName is deprecated. Use pc.Material#name instead.');
    // #endif
    return this.name;
};

pc.Material.prototype.setName = function (name) {
    // #ifdef DEBUG
    console.warn('DEPRECATED: pc.Material#setName is deprecated. Use pc.Material#name instead.');
    // #endif
    this.name = name;
};

pc.Material.prototype.getShader = function () {
    // #ifdef DEBUG
    console.warn('DEPRECATED: pc.Material#getShader is deprecated. Use pc.Material#shader instead.');
    // #endif
    return this.shader;
};

pc.Material.prototype.setShader = function (shader) {
    // #ifdef DEBUG
    console.warn('DEPRECATED: pc.Material#setShader is deprecated. Use pc.Material#shader instead.');
    // #endif
    this.shader = shader;
};

pc.RigidBodyComponentSystem.prototype.setGravity = function () {
    // #ifdef DEBUG
    console.warn('DEPRECATED: pc.RigidBodyComponentSystem#setGravity is deprecated. Use pc.RigidBodyComponentSystem#gravity instead.');
    // #endif

    if (arguments.length === 1) {
        this.gravity.copy(arguments[0]);
    } else {
        this.gravity.set(arguments[0], arguments[1], arguments[2]);
    }
};

pc.SoundManager.prototype.getListener = function () {
    // #ifdef DEBUG
    console.warn('DEPRECATED: pc.SoundManager#getListener is deprecated. Use pc.SoundManager#listener instead.');
    // #endif
    return this.listener;
};

pc.SoundManager.prototype.getVolume = function () {
    // #ifdef DEBUG
    console.warn('DEPRECATED: pc.SoundManager#getVolume is deprecated. Use pc.SoundManager#volume instead.');
    // #endif
    return this.volume;
};

pc.SoundManager.prototype.setVolume = function (volume) {
    // #ifdef DEBUG
    console.warn('DEPRECATED: pc.SoundManager#setVolume is deprecated. Use pc.SoundManager#volume instead.');
    // #endif
    this.volume = volume;
};

