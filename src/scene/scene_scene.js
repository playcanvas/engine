(function () {
    // Scene API enums
    var enums = {
        /**
         * @enum pc.BLEND
         * @name pc.BLEND_SUBTRACTIVE
         * @description Subtract the color of the source fragment from the destination fragment
         * and write the result to the frame buffer.
         */
        BLEND_SUBTRACTIVE: 0,
        /**
         * @enum pc.BLEND
         * @name pc.BLEND_ADDITIVE
         * @description Add the color of the source fragment to the destination fragment
         * and write the result to the frame buffer.
         */
        BLEND_ADDITIVE: 1,
        /**
         * @enum pc.BLEND
         * @name pc.BLEND_NORMAL
         * @description Enable simple translucency for materials such as glass. This is
         * equivalent to enabling a source blend mode of pc.BLENDMODE_SRC_ALPHA and a destination
         * blend mode of pc.BLENDMODE_ONE_MINUS_SRC_ALPHA.
         */
        BLEND_NORMAL: 2,
        /**
         * @enum pc.BLEND
         * @name pc.BLEND_NONE
         * @description Disable blending.
         */
        BLEND_NONE: 3,
        /**
         * @enum pc.BLEND
         * @name pc.BLEND_PREMULTIPLIED
         * @description Similar to pc.BLEND_NORMAL expect the source fragment is assumed to have
         * already been multiplied by the source alpha value.
         */
        BLEND_PREMULTIPLIED: 4,
        /**
         * @enum pc.BLEND
         * @name pc.BLEND_MULTIPLICATIVE
         * @description Multiply the color of the source fragment by the color of the destination
         * fragment and write the result to the frame buffer.
         */
        BLEND_MULTIPLICATIVE: 5,

        /**
         * @enum pc.FOG
         * @name pc.FOG_NONE
         * @description No fog is applied to the scene.
         */
        FOG_NONE: 'none',
        /**
         * @enum pc.FOG
         * @name pc.FOG_LINEAR
         * @description Fog rises linearly from zero to 1 between a start and end depth.
         */
        FOG_LINEAR: 'linear',
        /**
         * @enum pc.FOG
         * @name pc.FOG_EXP
         * @description Fog rises according to an exponential curve controlled by a density value.
         */
        FOG_EXP: 'exp',
        /**
         * @enum pc.FOG
         * @name pc.FOG_EXP2
         * @description Fog rises according to an exponential curve controlled by a density value.
         */
        FOG_EXP2: 'exp2',

        FRESNEL_NONE: 0,
        FRESNEL_SIMPLE: 1,
        FRESNEL_SCHLICK: 2,
        FRESNEL_COMPLEX: 3,

        LAYER_HUD: 0,
        LAYER_GIZMO: 1,
        LAYER_FX: 2,
        LAYER_WORLD: 3,

        /**
         * @enum pc.LIGHTTYPE
         * @name pc.LIGHTTYPE_DIRECTIONAL
         * @description Directional (global) light source.
         */
        LIGHTTYPE_DIRECTIONAL: 0,
        /**
         * @enum pc.LIGHTTYPE
         * @name pc.LIGHTTYPE_POINT
         * @description Point (local) light source.
         */
        LIGHTTYPE_POINT: 1,
        /**
         * @enum pc.LIGHTTYPE
         * @name pc.LIGHTTYPE_SPOT
         * @description Spot (local) light source.
         */
        LIGHTTYPE_SPOT: 2,

        LIGHTFALLOFF_LINEAR: 0,
        LIGHTFALLOFF_INVERSESQUARED: 1,

        PARTICLESORT_NONE: 0,
        PARTICLESORT_DISTANCE: 1,
        PARTICLESORT_NEWER_FIRST: 2,
        PARTICLESORT_OLDER_FIRST: 3,
        PARTICLEMODE_GPU: 0,
        PARTICLEMODE_CPU: 1,

        /**
         * @enum pc.PROJECTION
         * @name pc.PROJECTION_PERSPECTIVE
         * @description A perspective camera projection where the frustum shape is essentially pyrimidal.
         */
        PROJECTION_PERSPECTIVE: 0,
        /**
         * @enum pc.PROJECTION
         * @name pc.PROJECTION_ORTHOGRAPHIC
         * @description An orthographic camera projection where the frustum shape is essentially a cuboid.
         */
        PROJECTION_ORTHOGRAPHIC: 1,

        RENDERSTYLE_SOLID: 0,
        RENDERSTYLE_WIREFRAME: 1,
        RENDERSTYLE_POINTS: 2,

        SPECULAR_PHONG: 0,
        SPECULAR_BLINN: 1,

        TONEMAP_LINEAR: 0,
        TONEMAP_FILMIC: 1
    };

    pc.extend(pc, enums);

    // For backwards compatibility
    pc.scene = {};
    pc.extend(pc.scene, enums);
}());

pc.extend(pc, function () {
    /**
     * @name pc.Scene
     * @class A scene is a container for models, lights and cameras. Scenes are rendered via a renderer.
     * PlayCanvas currently only supports a single renderer: the forward renderer (pc.ForwardRenderer).
     * @constructor Creates a new scene.
     * @property {pc.Color} ambientLight The color of the scene's ambient light.
     * @property {String} fog The type of fog used by the scene (see pc.FOG_).
     * @property {pc.Color} fogColor The color of the fog, in enabled.
     * @property {Number} fogDensity The density of the fog. This property is only valid if the fog property
     * is set to pc.FOG_EXP or pc.FOG_EXP2.
     * @property {Number} fogEnd The distance from the viewpoint where linear fog reaches its maximum. This
     * property is only valid if the fog property is set to pc.FOG_LINEAR.
     * @property {Number} fogStart The distance from the viewpoint where linear fog begins. This property is
     * only valid if the fog property is set to pc.FOG_LINEAR.
     * @property {Boolean} gammaCorrection If true then all materials will apply gamma correction.
     * @property {pc.TONEMAP} tomeMapping The tonemapping transform to apply when writing fragments to the 
     * frame buffer. Default is pc.TONEMAP_LINEAR.
     * @property {pc.Texture} skybox A cube map texture used as the scene's skybox.
     */
    var Scene = function Scene() {
        this.drawCalls = [];     // All mesh instances and commands
        this.shadowCasters = []; // All mesh instances that cast shadows

        this.fog = pc.FOG_NONE;
        this.fogColor = new pc.Color(0, 0, 0);
        this.fogStart = 1;
        this.fogEnd = 1000;
        this.fogDensity = 0;

        this.ambientLight = new pc.Color(0, 0, 0);

        this._gammaCorrection = false;
        this._toneMapping = 0;
        this.exposure = 1.0;

        this._prefilteredCubeMap128 = null;
        this._prefilteredCubeMap64 = null;
        this._prefilteredCubeMap32 = null;
        this._prefilteredCubeMap16 = null;
        this._prefilteredCubeMap8 = null;
        this._prefilteredCubeMap4 = null;

        this._skyboxCubeMap = null;
        this._skyboxModel = null;


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
                pc.shaderChunks.defaultGamma = value ? pc.shaderChunks.gamma2_2PS : pc.shaderChunks.gamma1_0PS;
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
                pc.shaderChunks.defaultTonemapping = value ? pc.shaderChunks.tonemappingFilmicPS : pc.shaderChunks.tonemappingLinearPS;
                this.updateShaders = true;
            }
        }
    });

    Object.defineProperty(Scene.prototype, 'skybox', {
        get: function () {
            return this._skyboxCubeMap;
        },
        set: function (value) {
            if (value !== this._skyboxCubeMap) {
                this._skyboxCubeMap = value;
                if (this._skyboxModel) {
                    if (this.containsModel(this._skyboxModel)) {
                        this.removeModel(this._skyboxModel);
                    }
                }
                this._skyboxModel = null;
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

        if (this._skyboxCubeMap && !this._skyboxModel) {
            var material = new pc.Material();
            var scene = this;
            material.updateShader = function() {
                var library = device.getProgramLibrary();
                var shader = library.getProgram('skybox', {hdr:scene._skyboxCubeMap.hdr, prefiltered:scene._skyboxCubeMap.hdr, gamma:scene.gammaCorrection, toneMapping:scene.toneMapping});
                this.setShader(shader);
            };

            material.updateShader();
            material.setParameter("texture_cubeMap", this._skyboxCubeMap);
            material.cull = pc.CULLFACE_NONE;

            var node = new pc.GraphNode();
            var mesh = pc.createBox(device);
            var meshInstance = new pc.MeshInstance(node, mesh, material);

            var model = new pc.Model();
            model.graph = node;
            model.meshInstances = [ meshInstance ];
            this._skyboxModel = model;

            this.addModel(model);
        }

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
     * @name pc.Scene#addModel
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
     * @name pc.Scene#removeModel
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
            console.warn("pc.Scene#addLight: light is already in the scene");
        } else {
            this._lights.push(light);
            light._scene = this;
            this.updateShaders = true;
        }
    };

    Scene.prototype.removeLight = function (light) {
        var index = this._lights.indexOf(light);
        if (index === -1) {
            console.warn("pc.Scene#removeLight: light is not in the scene");
        } else {
            this._lights.splice(index, 1);
            light._scene = null;
            this.updateShaders = true;
        }
    };

    /**
     * @function
     * @name pc.Scene#update
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
