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

        BLEND_ADDITIVEALPHA: 6,

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
        FRESNEL_SCHLICK: 2,

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

        SHADOW_DEPTH: 0,
        SHADOW_DEPTHMASK: 1,

        SHADOWSAMPLE_HARD: 0,
        SHADOWSAMPLE_PCF3X3: 1,
        SHADOWSAMPLE_MASK: 2,

        PARTICLESORT_NONE: 0,
        PARTICLESORT_DISTANCE: 1,
        PARTICLESORT_NEWER_FIRST: 2,
        PARTICLESORT_OLDER_FIRST: 3,
        PARTICLEMODE_GPU: 0,
        PARTICLEMODE_CPU: 1,
        EMITTERSHAPE_BOX: 0,
        EMITTERSHAPE_SPHERE: 1,

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

        CUBEPROJ_NONE: 0,
        CUBEPROJ_BOX: 1,

        SPECULAR_PHONG: 0,
        SPECULAR_BLINN: 1,

        GAMMA_NONE: 0,
        GAMMA_SRGB: 1,
        GAMMA_SRGBFAST: 2,

        TONEMAP_LINEAR: 0,
        TONEMAP_FILMIC: 1,

        SHADERDEF_NOSHADOW: 1,
        SHADERDEF_SKIN: 2,
        SHADERDEF_UV1: 4,
        SHADERDEF_VCOLOR: 8,
        SHADERDEF_INSTANCING: 16,

        LINEBATCH_WORLD: 0,
        LINEBATCH_OVERLAY: 1,
        LINEBATCH_GIZMO: 2,

        SHADOWUPDATE_NONE: 0,
        SHADOWUPDATE_THISFRAME: 1,
        SHADOWUPDATE_REALTIME: 2
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
     * @property {pc.GAMMA} gammaCorrection Possible values are pc.GAMMA_NONE (no gamma correction), pc.GAMMA_SRGB and pc.GAMMA_SRGBFAST
     * @property {pc.TONEMAP} tomeMapping The tonemapping transform to apply when writing fragments to the
     * frame buffer. Default is pc.TONEMAP_LINEAR.
     * @property {pc.Texture} skybox A cube map texture used as the scene's skybox.
     */
    var Scene = function Scene() {
        this.root = null;

        this._gravity = new pc.Vec3(0, -9.8, 0);

        this.drawCalls = [];     // All mesh instances and commands
        this.shadowCasters = []; // All mesh instances that cast shadows
        this.immediateDrawCalls = []; // Only for this frame

        // Statistics
        this.depthDrawCalls = 0;
        this.shadowDrawCalls = 0;
        this.forwardDrawCalls = 0;

        this.fog = pc.FOG_NONE;
        this.fogColor = new pc.Color(0, 0, 0);
        this.fogStart = 1;
        this.fogEnd = 1000;
        this.fogDensity = 0;

        this.ambientLight = new pc.Color(0, 0, 0);

        this._gammaCorrection = pc.GAMMA_NONE;
        this._toneMapping = 0;
        this.exposure = 1.0;

        this._skyboxPrefiltered128 = null;
        this._skyboxPrefiltered64 = null;
        this._skyboxPrefiltered32 = null;
        this._skyboxPrefiltered16 = null;
        this._skyboxPrefiltered8 = null;
        this._skyboxPrefiltered4 = null;

        this._skyboxCubeMap = null;
        this._skyboxModel = null;

        this._skyboxIntensity = 1;
        this._skyboxMip = 0;


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
                this.updateShaders = true;
            }
        }
    });

    Object.defineProperty(Scene.prototype, 'skybox', {
        get: function () {
            return this._skyboxCubeMap;
        },
        set: function (value) {
            this._skyboxCubeMap = value;
            this._resetSkyboxModel();
            this.updateShaders = true;
        }
    });

    Object.defineProperty(Scene.prototype, 'skyboxIntensity', {
        get: function () {
            return this._skyboxIntensity;
        },
        set: function (value) {
            this._skyboxIntensity = value;
            // this._skyboxModel = null;
            this._resetSkyboxModel();
            this.updateShaders = true;
        }
    });

    Object.defineProperty(Scene.prototype, 'skyboxMip', {
        get: function () {
            return this._skyboxMip;
        },
        set: function (value) {
            this._skyboxMip = value;
            // this._skyboxModel = null;
            this._resetSkyboxModel();
            this.updateShaders = true;
        }
    });

    Object.defineProperty(Scene.prototype, 'skyboxPrefiltered128', {
        get: function () {
            return this._skyboxPrefiltered128;
        },
        set: function (value) {
            this._skyboxPrefiltered128 = value;
            this.updateShaders = true;
        }
    });

    Object.defineProperty(Scene.prototype, 'skyboxPrefiltered64', {
        get: function () {
            return this._skyboxPrefiltered64;
        },
        set: function (value) {
            this._skyboxPrefiltered64 = value;
            this.updateShaders = true;
        }
    });

    Object.defineProperty(Scene.prototype, 'skyboxPrefiltered32', {
        get: function () {
            return this._skyboxPrefiltered32;
        },
        set: function (value) {
            this._skyboxPrefiltered32 = value;
            this.updateShaders = true;
        }
    });

    Object.defineProperty(Scene.prototype, 'skyboxPrefiltered16', {
        get: function () {
            return this._skyboxPrefiltered16;
        },
        set: function (value) {
            this._skyboxPrefiltered16 = value;
            this.updateShaders = true;
        }
    });

    Object.defineProperty(Scene.prototype, 'skyboxPrefiltered8', {
        get: function () {
            return this._skyboxPrefiltered8;
        },
        set: function (value) {
            this._skyboxPrefiltered8 = value;
            this.updateShaders = true;
        }
    });

    Object.defineProperty(Scene.prototype, 'skyboxPrefiltered4', {
        get: function () {
            return this._skyboxPrefiltered4;
        },
        set: function (value) {
            this._skyboxPrefiltered4 = value;
            this.updateShaders = true;
        }
    });

    Scene.prototype.applySettings = function (settings) {
        // settings
        this._gravity.set(settings.physics.gravity[0], settings.physics.gravity[1], settings.physics.gravity[2]);

        var al = settings.render.global_ambient;
        this.ambientLight = new pc.Color(al[0], al[1], al[2]);

        this.fog = settings.render.fog;

        var fogColor = settings.render.fog_color;
        this.fogColor = new pc.Color(fogColor[0], fogColor[1], fogColor[2]);

        this.fogStart = settings.render.fog_start;
        this.fogEnd = settings.render.fog_end;
        this.fogDensity = settings.render.fog_density;
        this.gammaCorrection = settings.render.gamma_correction;
        this.toneMapping = settings.render.tonemapping;
        this.exposure = settings.render.exposure;
        this.skyboxIntensity = settings.render.skyboxIntensity===undefined? 1 : settings.render.skyboxIntensity;
        this.skyboxMip = settings.render.skyboxMip===undefined? 0 : settings.render.skyboxMip;
    };

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
                var shader = library.getProgram('skybox', {rgbm:scene._skyboxCubeMap.rgbm,
                    hdr: (scene._skyboxCubeMap.rgbm || scene._skyboxCubeMap.format===pc.PIXELFORMAT_RGBA32F),
                    useIntensity: scene.skyboxIntensity!==1,
                    mip: scene._skyboxCubeMap.fixCubemapSeams? scene.skyboxMip : 0,
                    fixSeams: scene._skyboxCubeMap.fixCubemapSeams, gamma:scene.gammaCorrection, toneMapping:scene.toneMapping});
                this.setShader(shader);
            };

            material.updateShader();
            if (!this._skyboxCubeMap.fixCubemapSeams || !scene._skyboxMip) {
                material.setParameter("texture_cubeMap", this._skyboxCubeMap);
            } else {
                var mip2tex = [null, "64", "16", "8", "4"];
                var mipTex = this["skyboxPrefiltered" + mip2tex[scene._skyboxMip]];
                if (mipTex)
                    material.setParameter("texture_cubeMap", mipTex);
            }
            material.cull = pc.CULLFACE_NONE;

            var node = new pc.GraphNode();
            var mesh = pc.createBox(device);
            var meshInstance = new pc.MeshInstance(node, mesh, material);
            meshInstance.updateKey = function () {
                var material = this.material;
                this.key = pc._getDrawcallSortKey(this.layer, material.blendType, false, 0); // force drawing after all opaque
            };
            meshInstance.updateKey();
            meshInstance.cull = false;

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
            var mat = materials[i];
            if (mat.updateShader!==pc.Material.prototype.updateShader) {
                mat.clearVariants();
                mat.shader = null;
            }
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

    Scene.prototype._resetSkyboxModel = function () {
        if (this._skyboxModel) {
            if (this.containsModel(this._skyboxModel)) {
                this.removeModel(this._skyboxModel);
            }
        }
        this._skyboxModel = null;
    };

    Scene.prototype.setSkybox = function (cubemaps) {
        if (cubemaps !== null) {
            this._skyboxPrefiltered128 = cubemaps[1];
            this._skyboxPrefiltered64 = cubemaps[2];
            this._skyboxPrefiltered32 = cubemaps[3];
            this._skyboxPrefiltered16 = cubemaps[4];
            this._skyboxPrefiltered8 = cubemaps[5];
            this._skyboxPrefiltered4 = cubemaps[6];
            this.skybox = cubemaps[0];
        } else {
            this._skyboxPrefiltered128 = null;
            this._skyboxPrefiltered64 = null;
            this._skyboxPrefiltered32 = null;
            this._skyboxPrefiltered16 = null;
            this._skyboxPrefiltered8 = null;
            this._skyboxPrefiltered4 = null;
            this.skybox = null;
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

    Scene.prototype.destroy = function () {
        var i;
        var models = this.getModels();
        for (i = 0; i < models.length; i++) {
            this.removeModel(models[i]);
        }

        for (i = 0; i < this._lights.length; i++) {
            this.removeLight(this._lights[i]);
        }

        this.skybox = null;
    };

    return {
        Scene: Scene
    };
}());
