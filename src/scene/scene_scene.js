/**
 * @name pc.scene
 * @namespace High level Graphics API
 */
pc.scene = {
    BLEND_SUBTRACTIVE: 0,
    BLEND_ADDITIVE: 1,
    BLEND_NORMAL: 2,
    BLEND_NONE: 3,

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
    FOG_EXP2: 'exp2'
};

pc.extend(pc.scene, function () {

    /**
     * @name pc.scene.Scene
     * @class A scene is a container for models, lights and cameras. Scenes are rendered via a renderer.
     * PlayCanvas currently only supports a single renderer: the forward renderer (pc.scene.ForwardRenderer).
     * @constructor Creates a new scene.
     * @property {String} fog The type of fog used by the scene (see pc.scene.FOG_).
     * @property {pc.Color} fogColor The color of the fog, in enabled.
     * @property {Number} fogStart The distance from the viewpoint where linear fog begins. This property is
     * only valid if the fog property is set to pc.scene.FOG_LINEAR.
     * @property {Number} fogEnd The distance from the viewpoint where linear fog reaches its maximum. This 
     * property is only valid if the fog property is set to pc.scene.FOG_LINEAR.
     * @property {Number} fogDensity The density of the fog. This property is only valid if the fog property
     * is set to pc.scene.FOG_EXP or pc.scene.FOG_EXP2.
     */
    var Scene = function Scene() {
        this.drawCalls = [];     // All mesh instances and commands
        this.shadowCasters = []; // All mesh instances that cast shadows

        this.fog = pc.scene.FOG_NONE;
        this.fogColor = new pc.Color(0, 0, 0);
        this.fogStart = 1;
        this.fogEnd = 1000;
        this.fogDensity = 0;

        // Models
        this._models = [];

        // Lights
        this._lights = [];
        this._globalAmbient = pc.math.vec3.create(0, 0, 0);
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

    // Shaders have to be updated if:
    // - the fog mode changes
    // - lights are added or removed
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
            materials[i].updateShader(device);
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


    /**
     * @function
     * @name pc.scene.Scene#getGlobalAmbient
     * @description Queries the current global ambient color. This color is uploaded to a
     * vector uniform called 'light_globalAmbient'. The PlayCanvas 'phong' shader uses this
     * value by multiplying it by the material color of a mesh's material and adding it to
     * the total light contribution.
     * @returns {Array} The global ambient color represented by a 3 dimensional array (RGB components ranging 0..1).
     * @author Will Eastcott
     */
    Scene.prototype.getGlobalAmbient = function () {
        return this._globalAmbient;
    };

    /**
     * @function
     * @name pc.scene.Scene#setGlobalAmbient
     * @description Sets the current global ambient color. This color is uploaded to a
     * vector uniform called 'light_globalAmbient'. The PlayCanvas 'phong' shader uses this
     * value by multiplying it by the material color of a mesh's material and adding it to
     * the total light contribution.
     * @param {pc.math.vec3} ambient The global ambient color represented by a 3 dimensional array (RGB components ranging 0..1).
     * @author Will Eastcott
     */
    /**
     * @function
     * @name pc.scene.Scene#setGlobalAmbient^2
     * @description Sets the current global ambient color. This color is uploaded to a
     * vector uniform called 'light_globalAmbient'. The PlayCanvas 'phong' shader uses this
     * value by multiplying it by the material color of a mesh's material and adding it to
     * the total light contribution.
     * @param {Number} red The red component of the global ambient color (should be in range 0..1).
     * @param {Number} green The green component of the global ambient color (should be in range 0..1).
     * @param {Number} blue The blue component of the global ambient color (should be in range 0..1).
     * @author Will Eastcott
     */
    Scene.prototype.setGlobalAmbient = function () {
        if (arguments.length === 3) {
            pc.math.vec3.set(this._globalAmbient, arguments[0], arguments[1], arguments[2]);
        } else {
            pc.math.vec3.copy(arguments[0], this._globalAmbient);
        }
    };

    return {
        Scene: Scene
    };
}());
