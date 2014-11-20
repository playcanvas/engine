/**
 * @name pc.scene
 * @namespace High level Graphics API
 */
pc.scene = {
    BLEND_SUBTRACTIVE: 0,
    BLEND_ADDITIVE: 1,
    BLEND_NORMAL: 2,
    BLEND_NONE: 3,
    BLEND_PREMULTIPLIED: 4,
    BLEND_MULTIPLICATIVE: 5,

    RENDERSTYLE_SOLID: 0,
    RENDERSTYLE_WIREFRAME: 1,
    RENDERSTYLE_POINTS: 2,

    LAYER_HUD: 0,
    LAYER_GIZMO: 1,
    LAYER_FX: 2,
    LAYER_WORLD: 3,

    /**
     * @enum pc.scene.FOG
     * @name pc.scene.FOG_NONE
     * @description No fog is applied to the scene.
     */
    FOG_NONE: 'none',
    /**
     * @enum pc.scene.FOG
     * @name pc.scene.FOG_LINEAR
     * @description Fog rises linearly from zero to 1 between a start and end depth.
     */
    FOG_LINEAR: 'linear',
    /**
     * @enum pc.scene.FOG
     * @name pc.scene.FOG_EXP
     * @description Fog rises according to an exponential curve controlled by a density value.
     */
    FOG_EXP: 'exp',
    /**
     * @enum pc.scene.FOG
     * @name pc.scene.FOG_EXP2
     * @description Fog rises according to an exponential curve controlled by a density value.
     */
    FOG_EXP2: 'exp2',

    TONEMAP_LINEAR: 0,
    TONEMAP_FILMIC: 1,

    SPECULAR_PHONG: 0,
    SPECULAR_BLINN: 1,

    FRESNEL_NONE: 0,
    FRESNEL_SIMPLE: 1,
    FRESNEL_SCHLICK: 2,
    FRESNEL_COMPLEX: 3
};

pc.extend(pc.scene, function () {

    /**
     * @name pc.scene.Scene
     * @class A scene is a container for models, lights and cameras. Scenes are rendered via a renderer.
     * PlayCanvas currently only supports a single renderer: the forward renderer (pc.scene.ForwardRenderer).
     * @constructor Creates a new scene.
     * @property {pc.Color} ambientLight The color of the scene's ambient light.
     * @property {String} fog The type of fog used by the scene (see pc.scene.FOG_).
     * @property {pc.Color} fogColor The color of the fog, in enabled.
     * @property {Number} fogDensity The density of the fog. This property is only valid if the fog property
     * is set to pc.scene.FOG_EXP or pc.scene.FOG_EXP2.
     * @property {Number} fogEnd The distance from the viewpoint where linear fog reaches its maximum. This
     * property is only valid if the fog property is set to pc.scene.FOG_LINEAR.
     * @property {Number} fogStart The distance from the viewpoint where linear fog begins. This property is
     * only valid if the fog property is set to pc.scene.FOG_LINEAR.
     * @property {Number} shadowDistance The distance from the viewpoint beyond which shadows are no longer
     * @property {Boolean} gammaCorrection If true then all materials will apply gamma correction
     * rendered.
     */
    var Scene = function Scene() {
        this.drawCalls = [];     // All mesh instances and commands
        this.shadowCasters = []; // All mesh instances that cast shadows

        this.fog = pc.scene.FOG_NONE;
        this.fogColor = new pc.Color(0, 0, 0);
        this.fogStart = 1;
        this.fogEnd = 1000;
        this.fogDensity = 0;

        this.ambientLight = new pc.Color(0, 0, 0);

        this.shadowDistance = 40;
        this._gammaCorrection = false;
        this._toneMapping = 0;
        this.exposure = 1.0;

        // Models
        this._models = [];

        // Lights
        this._lights = [];
        this._globalLights = []; // All currently enabled directionals
        this._localLights = [[], []]; // All currently enabled points and spots

        this.updateShaders = true;
    };

    Object.defineProperty(Scene.prototype, 'fog', {
        get: function () {
            return this._fog;
        },
        set: function (type) {
            if (type !== this._fog) {
                this._fog = type;
                this.updateShaders = true;
            }
        }
    });

    Object.defineProperty(Scene.prototype, 'gammaCorrection', {
        get: function () {
            return this._gammaCorrection;
        },
        set: function (value) {
            if (value !== this._gammaCorrection) {
                this._gammaCorrection = value;
                pc.gfx.shaderChunks.defaultGamma = value ? pc.gfx.shaderChunks.gamma2_2PS : pc.gfx.shaderChunks.gamma1_0PS;
                this.updateShaders = true;
            }
        }
    });

    Object.defineProperty(Scene.prototype, 'toneMapping', {
        get: function () {
            return this._toneMapping;
        },
        set: function (value) {
            if (value !== this._toneMapping) {
                this._toneMapping = value;
                pc.gfx.shaderChunks.defaultTonemapping = value ? pc.gfx.shaderChunks.tonemappingFilmicPS : pc.gfx.shaderChunks.tonemappingLinearPS;
                this.updateShaders = true;
            }
        }
    });

    // Shaders have to be updated if:
    // - the fog mode changes
    // - lights are added or removed
    // - gamma correction changes
    Scene.prototype._updateShaders = function (device) {
        var i;
        var materials = [];
        var drawCalls = this.drawCalls;
        for (i = 0; i < drawCalls.length; i++) {
            var drawCall = drawCalls[i];
            if (drawCall.material !== undefined) {
                if (materials.indexOf(drawCall.material) === -1) {
                    materials.push(drawCall.material);
                }
            }
        }
        for (i = 0; i < materials.length; i++) {
            materials[i].updateShader(device, this);
        }
    };

    Scene.prototype.getModels = function () {
        return this._models;
    };

    /**
     * @function
     * @name pc.scene.Scene#addModel
     * @description Adds the specified model to the scene.
     * @author Will Eastcott
     */
    Scene.prototype.addModel = function (model) {
        var i;

        // Check the model is not already in the scene
        var index = this._models.indexOf(model);
        if (index === -1) {
            this._models.push(model);

            var materials = model.getMaterials();
            for (i = 0; i < materials.length; i++) {
                materials[i].scene = this;
            }

            // Insert the model's mesh instances into lists ready for rendering
            var meshInstance;
            var numMeshInstances = model.meshInstances.length;
            for (i = 0; i < numMeshInstances; i++) {
                meshInstance = model.meshInstances[i];
                if (this.drawCalls.indexOf(meshInstance) === -1) {
                    this.drawCalls.push(meshInstance);
                }
                if (meshInstance.castShadow) {
                    if (this.shadowCasters.indexOf(meshInstance) === -1) {
                        this.shadowCasters.push(meshInstance);
                    }
                }
            }

            // Add all model lights to the scene
            var lights = model.getLights();
            for (i = 0, len = lights.length; i < len; i++) {
                this.addLight(lights[i]);
            }
        }
    };

    /**
     * @function
     * @name pc.scene.Scene#removeModel
     * @description Removes the specified model from the scene.
     * @author Will Eastcott
     */
    Scene.prototype.removeModel = function (model) {
        var i;

        // Verify the model is in the scene
        var index = this._models.indexOf(model);
        if (index !== -1) {
            this._models.splice(index, 1);

            var materials = model.getMaterials();
            for (i = 0; i < materials.length; i++) {
                materials[i].scene = null;
            }

            // Remove the model's mesh instances from render queues
            var meshInstance;
            var numMeshInstances = model.meshInstances.length;
            for (i = 0; i < numMeshInstances; i++) {
                meshInstance = model.meshInstances[i];
                index = this.drawCalls.indexOf(meshInstance);
                if (index !== -1) {
                    this.drawCalls.splice(index, 1);
                }
                if (meshInstance.castShadow) {
                    index = this.shadowCasters.indexOf(meshInstance);
                    if (index !== -1) {
                        this.shadowCasters.splice(index, 1);
                    }
                }
            }

            // Remove all model lights from the scene
            var lights = model.getLights();
            for (i = 0, len = lights.length; i < len; i++) {
                this.removeLight(lights[i]);
            }
        }
    };

    Scene.prototype.containsModel = function (model) {
        return this._models.indexOf(model) >= 0;
    };

    Scene.prototype.addLight = function (light) {
        var index = this._lights.indexOf(light);
        if (index !== -1) {
            console.warn("pc.scene.Scene#addLight: light is already in the scene");
        } else {
            this._lights.push(light);
            light._scene = this;
            this.updateShaders = true;
        }
    };

    Scene.prototype.removeLight = function (light) {
        var index = this._lights.indexOf(light);
        if (index === -1) {
            console.warn("pc.scene.Scene#removeLight: light is not in the scene");
        } else {
            this._lights.splice(index, 1);
            light._scene = null;
            this.updateShaders = true;
        }
    };

    /**
     * @function
     * @name pc.scene.Scene#update
     * @description Synchronizes the graph node hierarchy of every model in the scene.
     * @author Will Eastcott
     */
    Scene.prototype.update = function () {
        for (var i = 0, len = this._models.length; i < len; i++) {
            this._models[i].getGraph().syncHierarchy();
        }
    };

    return {
        Scene: Scene
    };
}());
