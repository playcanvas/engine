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
         * @enum pc.BLEND
         * @name pc.BLEND_ADDITIVEALPHA
         * @description Same as pc.BLEND_ADDITIVE except the source RGB is multiplied by the source alpha.
         */
        BLEND_ADDITIVEALPHA: 6,

        /**
         * @enum pc.BLEND
         * @name pc.BLEND_MULTIPLICATIVE2X
         * @description Multiplies colors and doubles the result
         */
        BLEND_MULTIPLICATIVE2X: 7,

        /**
         * @enum pc.BLEND
         * @name pc.BLEND_SCREEN
         * @description Softer version of additive
         */
        BLEND_SCREEN: 8,

        /**
         * @enum pc.BLEND
         * @name pc.BLEND_MIN
         * @description Minimum color. Check app.graphicsDevice.extBlendMinmax for support.
         */
        BLEND_MIN: 9,

        /**
         * @enum pc.BLEND
         * @name pc.BLEND_MAX
         * @description Maximum color. Check app.graphicsDevice.extBlendMinmax for support.
         */
        BLEND_MAX: 10,

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

        // Legacy
        LAYER_HUD: 0,
        LAYER_GIZMO: 1,
        LAYER_FX: 2,
        // 3 - 14 are custom user layers
        LAYER_WORLD: 15,

        // New layers
        /**
         * @enum pc.LAYERID
         * @name pc.LAYERID_WORLD
         * @description The world layer.
         */
        LAYERID_WORLD: 0,
        /**
         * @enum pc.LAYERID
         * @name pc.LAYERID_DEPTH
         * @description The depth layer.
         */
        LAYERID_DEPTH: 1,
        /**
         * @enum pc.LAYERID
         * @name pc.LAYERID_SKYBOX
         * @description The skybox layer.
         */
        LAYERID_SKYBOX: 2,
        /**
         * @enum pc.LAYERID
         * @name pc.LAYERID_IMMEDIATE
         * @description The immediate layer.
         */
        LAYERID_IMMEDIATE: 3,
        /**
         * @enum pc.LAYERID
         * @name pc.LAYERID_UI
         * @description The UI layer.
         */
        LAYERID_UI: 4,

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

        SHADOW_PCF3: 0,
        SHADOW_DEPTH: 0, // alias for SHADOW_PCF3 for backwards compatibility
        SHADOW_VSM8: 1,
        SHADOW_VSM16: 2,
        SHADOW_VSM32: 3,
        SHADOW_PCF5: 4,

        BLUR_BOX: 0,
        BLUR_GAUSSIAN: 1,

        PARTICLESORT_NONE: 0,
        PARTICLESORT_DISTANCE: 1,
        PARTICLESORT_NEWER_FIRST: 2,
        PARTICLESORT_OLDER_FIRST: 3,
        PARTICLEMODE_GPU: 0,
        PARTICLEMODE_CPU: 1,
        EMITTERSHAPE_BOX: 0,
        EMITTERSHAPE_SPHERE: 1,
        PARTICLEORIENTATION_SCREEN: 0,
        PARTICLEORIENTATION_WORLD: 1,
        PARTICLEORIENTATION_EMITTER: 2,

        /**
         * @enum pc.PROJECTION
         * @name pc.PROJECTION_PERSPECTIVE
         * @description A perspective camera projection where the frustum shape is essentially pyramidal.
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
        GAMMA_SRGBFAST: 2, // deprecated
        GAMMA_SRGBHDR: 3,

        TONEMAP_LINEAR: 0,
        TONEMAP_FILMIC: 1,
        TONEMAP_HEJL: 2,
        TONEMAP_ACES: 3,
        TONEMAP_ACES2: 4,

        SPECOCC_NONE: 0,
        SPECOCC_AO: 1,
        SPECOCC_GLOSSDEPENDENT: 2,

        SHADERDEF_NOSHADOW: 1,
        SHADERDEF_SKIN: 2,
        SHADERDEF_UV0: 4,
        SHADERDEF_UV1: 8,
        SHADERDEF_VCOLOR: 16,
        SHADERDEF_INSTANCING: 32,
        SHADERDEF_LM: 64,
        SHADERDEF_DIRLM: 128,
        SHADERDEF_SCREENSPACE: 256,
        SHADERDEF_TANGENTS: 512,

        LINEBATCH_WORLD: 0,
        LINEBATCH_OVERLAY: 1,
        LINEBATCH_GIZMO: 2,

        SHADOWUPDATE_NONE: 0,
        SHADOWUPDATE_THISFRAME: 1,
        SHADOWUPDATE_REALTIME: 2,

        SORTKEY_FORWARD: 0,
        SORTKEY_DEPTH: 1,

        MASK_DYNAMIC: 1,
        MASK_BAKED: 2,
        MASK_LIGHTMAP: 4,

        /**
         * @enum pc.SHADER
         * @name pc.SHADER_FORWARD
         * @description Render shaded materials with gamma correction and tonemapping.
         */
        SHADER_FORWARD: 0,

        /**
         * @enum pc.SHADER
         * @name pc.SHADER_FORWARD
         * @description Render shaded materials without gamma correction and tonemapping.
         */
        SHADER_FORWARDHDR: 1,

        /**
         * @enum pc.SHADER
         * @name pc.SHADER_FORWARD
         * @description Render RGBA-encoded depth value.
         */
        SHADER_DEPTH: 2,

        // next are undocumented
        SHADER_SHADOW: 3, // PCF3
        // 4: VSM8,
        // 5: VSM16,
        // 6: VSM32,
        // 7: PCF5,
        // 8: PCF3 POINT
        // 9: VSM8 POINT,
        // 10: VSM16 POINT,
        // 11: VSM32 POINT,
        // 12: PCF5 POINT
        // 13: PCF3 SPOT
        // 14: VSM8 SPOT,
        // 15: VSM16 SPOT,
        // 16: VSM32 SPOT,
        // 17: PCF5 SPOT
        SHADER_PICK: 18,

        BAKE_COLOR: 0,
        BAKE_COLORDIR: 1,

        VIEW_CENTER: 0,
        VIEW_LEFT: 1,
        VIEW_RIGHT: 2,

        /**
         * @enum pc.SORTMODE
         * @name pc.SORTMODE_NONE
         * @description No sorting is applied. Mesh instances are rendered in the same order they were added to a layer.
         */
        SORTMODE_NONE: 0,

        /**
         * @enum pc.SORTMODE
         * @name pc.SORTMODE_MANUAL
         * @description Mesh instances are sorted based on {@link pc.MeshInstance#drawOrder}.
         */
        SORTMODE_MANUAL: 1,

        /**
         * @enum pc.SORTMODE
         * @name pc.SORTMODE_MATERIALMESH
         * @description Mesh instances are sorted to minimize switching between materials and meshes to improve rendering performance.
         */
        SORTMODE_MATERIALMESH: 2,

        /**
         * @enum pc.SORTMODE
         * @name pc.SORTMODE_BACK2FRONT
         * @description Mesh instances are sorted back to front. This is the way to properly render many semi-transparent objects on different depth, one is blended on top of another.
         */
        SORTMODE_BACK2FRONT: 3,

        /**
         * @enum pc.SORTMODE
         * @name pc.SORTMODE_FRONT2BACK
         * @description Mesh instances are sorted front to back. Depending on GPU and the scene, this option may give better performance than pc.SORTMODE_MATERIALMESH due to reduced overdraw.
         */
        SORTMODE_FRONT2BACK: 4,

        /**
         * @private
         * @enum pc.SORTMODE
         * @name  pc.SORTMODE_CUSTOM
         * @description Provide custom functions for sorting drawcalls and calculating distance
         */
        SORTMODE_CUSTOM: 5,

        COMPUPDATED_INSTANCES: 1,
        COMPUPDATED_LIGHTS: 2,
        COMPUPDATED_CAMERAS: 4,
        COMPUPDATED_BLEND: 8,

        ASPECT_AUTO: 0,
        ASPECT_MANUAL: 1,

        /**
         * @enum pc.ORIENTATION
         * @name pc.ORIENTATION_HORIZONTAL
         * @description Horizontal orientation.
         */
        ORIENTATION_HORIZONTAL: 0,
        /**
         * @enum pc.ORIENTATION
         * @name pc.ORIENTATION_VERTICAL
         * @description Vertical orientation.
         */
        ORIENTATION_VERTICAL: 1
    };

    Object.assign(pc, enums);

    // For backwards compatibility
    pc.scene = {};
    Object.assign(pc.scene, enums);
}());

Object.assign(pc, function () {
    /**
     * @constructor
     * @name pc.Scene
     * @classdesc A scene is graphical representation of an environment. It manages the scene hierarchy, all
     * graphical objects, lights, and scene-wide properties.
     * @description Creates a new Scene.
     * @property {pc.Color} ambientLight The color of the scene's ambient light. Defaults to black (0, 0, 0).
     * @property {String} fog The type of fog used by the scene. Can be:
     * <ul>
     *     <li>pc.FOG_NONE</li>
     *     <li>pc.FOG_LINEAR</li>
     *     <li>pc.FOG_EXP</li>
     *     <li>pc.FOG_EXP2</li>
     * </ul>
     * Defaults to pc.FOG_NONE.
     * @property {pc.Color} fogColor The color of the fog (if enabled). Defaults to black (0, 0, 0).
     * @property {Number} fogDensity The density of the fog (if enabled). This property is only valid if the
     * fog property is set to pc.FOG_EXP or pc.FOG_EXP2. Defaults to 0.
     * @property {Number} fogEnd The distance from the viewpoint where linear fog reaches its maximum. This
     * property is only valid if the fog property is set to pc.FOG_LINEAR. Defaults to 1000.
     * @property {Number} fogStart The distance from the viewpoint where linear fog begins. This property is
     * only valid if the fog property is set to pc.FOG_LINEAR. Defaults to 1.
     * @property {Number} gammaCorrection The gamma correction to apply when rendering the scene. Can be:
     * <ul>
     *     <li>pc.GAMMA_NONE</li>
     *     <li>pc.GAMMA_SRGB</li>
     * </ul>
     * Defaults to pc.GAMMA_NONE.
     * @property {Number} toneMapping The tonemapping transform to apply when writing fragments to the
     * frame buffer. Can be:
     * <ul>
     *     <li>pc.TONEMAP_LINEAR</li>
     *     <li>pc.TONEMAP_FILMIC</li>
     *     <li>pc.TONEMAP_HEJL</li>
     *     <li>pc.TONEMAP_ACES</li>
     * </ul>
     * Defaults to pc.TONEMAP_LINEAR.
     * @property {pc.Texture} skybox A cube map texture used as the scene's skybox. Defaults to null.
     * @property {Number} skyboxIntensity Multiplier for skybox intensity. Defaults to 1.
     * @property {Number} skyboxMip The mip level of the skybox to be displayed. Only valid for prefiltered
     * cubemap skyboxes. Defaults to 0 (base level).
     * @property {Number} lightmapSizeMultiplier The lightmap resolution multiplier. Defaults to 1.
     * @property {Number} lightmapMaxResolution The maximum lightmap resolution. Defaults to 2048.
     * @property {Number} lightmapMode The lightmap baking mode. Can be:
     * <ul>
     *     <li>pc.BAKE_COLOR: single color lightmap
     *     <li>pc.BAKE_COLORDIR: single color lightmap + dominant light direction (used for bump/specular)
     * </ul>
     * Only lights with bakeDir=true will be used for generating the dominant light direction. Defaults to
     * pc.BAKE_COLORDIR.
     * @property {pc.LayerComposition} layers A {@link pc.LayerComposition} that defines rendering order of this scene.
     */
    var Scene = function Scene() {
        this.root = null;

        this._gravity = new pc.Vec3(0, -9.8, 0);

        this._layers = null;

        this._fog = pc.FOG_NONE;
        this.fogColor = new pc.Color(0, 0, 0);
        this.fogStart = 1;
        this.fogEnd = 1000;
        this.fogDensity = 0;

        this.ambientLight = new pc.Color(0, 0, 0);

        this._gammaCorrection = pc.GAMMA_NONE;
        this._toneMapping = 0;
        this.exposure = 1.0;

        this._skyboxPrefiltered = [null, null, null, null, null, null];

        this._skyboxCubeMap = null;
        this.skyboxModel = null;

        this._skyboxIntensity = 1;
        this._skyboxMip = 0;

        this.lightmapSizeMultiplier = 1;
        this.lightmapMaxResolution = 2048;
        this.lightmapMode = pc.BAKE_COLORDIR;

        this._stats = {
            meshInstances: 0,
            lights: 0,
            dynamicLights: 0,
            bakedLights: 0,
            lastStaticPrepareFullTime: 0,
            lastStaticPrepareSearchTime: 0,
            lastStaticPrepareWriteTime: 0,
            lastStaticPrepareTriAabbTime: 0,
            lastStaticPrepareCombineTime: 0,
            updateShadersTime: 0
        };

        this.updateShaders = true;
        this.updateSkybox = true;

        this._shaderVersion = 0;
        this._statsUpdated = false;

        // backwards compatibilty only
        this._models = [];

        // default material used in case no other material is available
        this.defaultMaterial = new pc.StandardMaterial();
        this.defaultMaterial.name = "Default Material";
        this.defaultMaterial.shadingModel = pc.SPECULAR_BLINN;

        pc.events.attach(this);
    };

    Scene.prototype.destroy = function () {
        this.root = null;
        this.defaultMaterial.destroy();
        this.defaultMaterial = null;
        this.off();
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
            this._resetSkyboxModel();
            this.updateShaders = true;
        }
    });

    Object.defineProperty(Scene.prototype, 'skyboxPrefiltered128', {
        get: function () {
            return this._skyboxPrefiltered[0];
        },
        set: function (value) {
            if (this._skyboxPrefiltered[0] === value)
                return;

            this._skyboxPrefiltered[0] = value;
            this.updateShaders = true;
        }
    });

    Object.defineProperty(Scene.prototype, 'skyboxPrefiltered64', {
        get: function () {
            return this._skyboxPrefiltered[1];
        },
        set: function (value) {
            if (this._skyboxPrefiltered[1] === value)
                return;

            this._skyboxPrefiltered[1] = value;
            this.updateShaders = true;
        }
    });

    Object.defineProperty(Scene.prototype, 'skyboxPrefiltered32', {
        get: function () {
            return this._skyboxPrefiltered[2];
        },
        set: function (value) {
            if (this._skyboxPrefiltered[2] === value)
                return;

            this._skyboxPrefiltered[2] = value;
            this.updateShaders = true;
        }
    });

    Object.defineProperty(Scene.prototype, 'skyboxPrefiltered16', {
        get: function () {
            return this._skyboxPrefiltered[3];
        },
        set: function (value) {
            if (this._skyboxPrefiltered[3] === value)
                return;

            this._skyboxPrefiltered[3] = value;
            this.updateShaders = true;
        }
    });

    Object.defineProperty(Scene.prototype, 'skyboxPrefiltered8', {
        get: function () {
            return this._skyboxPrefiltered[4];
        },
        set: function (value) {
            if (this._skyboxPrefiltered[4] === value)
                return;

            this._skyboxPrefiltered[4] = value;
            this.updateShaders = true;
        }
    });

    Object.defineProperty(Scene.prototype, 'skyboxPrefiltered4', {
        get: function () {
            return this._skyboxPrefiltered[5];
        },
        set: function (value) {
            if (this._skyboxPrefiltered[5] === value)
                return;

            this._skyboxPrefiltered[5] = value;
            this.updateShaders = true;
        }
    });

    // some backwards compatibility
    // drawCalls will now return list of all active composition mesh instances
    Object.defineProperty(Scene.prototype, 'drawCalls', {
        get: function () {
            var drawCalls = this.layers._meshInstances;
            if (!drawCalls.length) {
                this.layers._update();
                drawCalls = this.layers._meshInstances;
            }
            return drawCalls;
        },
        set: function (value) {

        }
    });

    Object.defineProperty(Scene.prototype, 'layers', {
        get: function () {
            return this._layers;
        },
        set: function (layers) {
            var prev = this._layers;
            this._layers = layers;
            this.fire("set:layers", prev, layers);
        }
    });

    Scene.prototype.applySettings = function (settings) {
        // settings
        this._gravity.set(settings.physics.gravity[0], settings.physics.gravity[1], settings.physics.gravity[2]);
        this.ambientLight.set(settings.render.global_ambient[0], settings.render.global_ambient[1], settings.render.global_ambient[2]);
        this._fog = settings.render.fog;
        this.fogColor.set(settings.render.fog_color[0], settings.render.fog_color[1], settings.render.fog_color[2]);
        this.fogStart = settings.render.fog_start;
        this.fogEnd = settings.render.fog_end;
        this.fogDensity = settings.render.fog_density;
        this._gammaCorrection = settings.render.gamma_correction;
        this._toneMapping = settings.render.tonemapping;
        this.lightmapSizeMultiplier = settings.render.lightmapSizeMultiplier;
        this.lightmapMaxResolution = settings.render.lightmapMaxResolution;
        this.lightmapMode = settings.render.lightmapMode;
        this.exposure = settings.render.exposure;
        this._skyboxIntensity = settings.render.skyboxIntensity === undefined ? 1 : settings.render.skyboxIntensity;
        this._skyboxMip = settings.render.skyboxMip === undefined ? 0 : settings.render.skyboxMip;

        this._resetSkyboxModel();
        this.updateShaders = true;
    };

    Scene.prototype._updateSkybox = function (device) {
        // Create skybox
        if (this._skyboxCubeMap && !this.skyboxModel) {
            var material = new pc.Material();
            var scene = this;
            material.updateShader = function (dev, sc, defs, staticLightList, pass) {
                var library = device.getProgramLibrary();
                var shader = library.getProgram('skybox', {
                    rgbm: scene._skyboxCubeMap.rgbm,
                    hdr: (scene._skyboxCubeMap.rgbm || scene._skyboxCubeMap.format === pc.PIXELFORMAT_RGBA32F),
                    useIntensity: scene.skyboxIntensity !== 1,
                    mip: scene._skyboxCubeMap.fixCubemapSeams ? scene.skyboxMip : 0,
                    fixSeams: scene._skyboxCubeMap.fixCubemapSeams,
                    gamma: (pass === pc.SHADER_FORWARDHDR ? (scene.gammaCorrection ? pc.GAMMA_SRGBHDR : pc.GAMMA_NONE) : scene.gammaCorrection),
                    toneMapping: (pass === pc.SHADER_FORWARDHDR ? pc.TONEMAP_LINEAR : scene.toneMapping)
                });
                this.shader = shader;
            };

            material.updateShader();
            var usedTex;
            if (!this._skyboxCubeMap.fixCubemapSeams || !scene._skyboxMip) {
                usedTex = this._skyboxCubeMap;
            } else {
                var mip2tex = [null, "64", "16", "8", "4"];
                var mipTex = this["skyboxPrefiltered" + mip2tex[scene._skyboxMip]];
                if (mipTex)
                    usedTex = mipTex;
            }
            material.setParameter("texture_cubeMap", usedTex);
            material.cull = pc.CULLFACE_NONE;

            var skyLayer = this.layers.getLayerById(pc.LAYERID_SKYBOX);
            if (skyLayer) {
                var node = new pc.GraphNode();
                var mesh = pc.createBox(device);
                var meshInstance = new pc.MeshInstance(node, mesh, material);
                meshInstance.cull = false;
                meshInstance._noDepthDrawGl1 = true;

                var model = new pc.Model();
                model.graph = node;
                model.meshInstances = [meshInstance];
                this.skyboxModel = model;

                skyLayer.addMeshInstances(model.meshInstances);
                skyLayer.enabled = true;
                this.skyLayer = skyLayer;

                this.fire("set:skybox", usedTex);
            }
        }
    };

    Scene.prototype._resetSkyboxModel = function () {
        if (this.skyboxModel) {
            this.skyLayer.removeMeshInstances(this.skyboxModel.meshInstances);
            this.skyLayer.enabled = false;
        }
        this.skyboxModel = null;
        this.updateSkybox = true;
    };

    Scene.prototype.setSkybox = function (cubemaps) {
        var i;
        if (!cubemaps)
            cubemaps = [null, null, null, null, null, null, null];

        // check if any values actually changed
        // to prevent unnecessary recompilations

        var different = false;

        if (this._skyboxCubeMap !== cubemaps[0])
            different = true;

        if (!different) {
            for (i = 0; i < 6 && !different; i++) {
                if (this._skyboxPrefiltered[i] !== cubemaps[i + 1])
                    different = true;
            }
        }

        if (!different)
            return;

        // set skybox

        for (i = 0; i < 6; i++)
            this._skyboxPrefiltered[i] = cubemaps[i + 1];

        this.skybox = cubemaps[0];
    };

    Scene.prototype.destroy = function () {
        this.skybox = null;
    };

    // Backwards compatibility
    Scene.prototype.addModel = function (model) {
        if (this.containsModel(model)) return;
        var layer = this.layers.getLayerById(pc.LAYERID_WORLD);
        if (!layer) return;
        layer.addMeshInstances(model.meshInstances);
        this._models.push(model);
    };
    Scene.prototype.addShadowCaster = function (model) {
        var layer = this.layers.getLayerById(pc.LAYERID_WORLD);
        if (!layer) return;
        layer.addShadowCasters(model.meshInstances);
    };
    Scene.prototype.removeModel = function (model) {
        var index = this._models.indexOf(model);
        if (index !== -1) {
            var layer = this.layers.getLayerById(pc.LAYERID_WORLD);
            if (!layer) return;
            layer.removeMeshInstances(model.meshInstances);
            this._models.splice(index, 1);
        }
    };
    Scene.prototype.removeShadowCasters = function (model) {
        var layer = this.layers.getLayerById(pc.LAYERID_WORLD);
        if (!layer) return;
        layer.removeShadowCasters(model.meshInstances);
    };
    Scene.prototype.containsModel = function (model) {
        return this._models.indexOf(model) >= 0;
    };
    Scene.prototype.getModels = function (model) {
        return this._models;
    };

    return {
        Scene: Scene
    };
}());

/**
 * @event
 * @name pc.Scene#set:skybox
 * @description Fired when the skybox is set.
 * @param {pc.Texture} usedTex Previously used cubemap texture. New is in the {@link pc.Scene#skybox}.
 */

/**
 * @event
 * @name pc.Scene#set:layers
 * @description Fired when the layer composition is set. Use this event to add callbacks or advanced properties to your layers.
 * @param {pc.LayerComposition} oldComp Previously used {@link pc.LayerComposition}.
 * @param {pc.LayerComposition} newComp Newly set {@link pc.LayerComposition}.
 * @example
 *   this.app.scene.on('set:layers', function(oldComp, newComp) {
 *       var list = newComp.layerList;
 *       var layer;
 *       for(var i=0; i<list.length; i++) {
 *           layer = list[i];
 *           switch(layer.name) {
 *               case 'MyLayer':
 *                   layer.onEnable = myOnEnableFunction;
 *                   layer.onDisable = myOnDisableFunction;
 *                   break;
 *               case 'MyOtherLayer':
 *                   layer.shaderPass = myShaderPass;
 *                   break;
 *           }
 *       }
 *   });
 */
