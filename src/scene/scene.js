import { Color } from '../core/color.js';
import { EventHandler } from '../core/event-handler.js';

import { Vec3 } from '../math/vec3.js';
import { Mat3 } from '../math/mat3.js';

import { CULLFACE_FRONT, PIXELFORMAT_RGBA32F, TEXTURETYPE_RGBM } from '../graphics/graphics.js';

import { BAKE_COLORDIR, FOG_NONE, GAMMA_NONE, GAMMA_SRGBHDR, LAYERID_SKYBOX, LAYERID_WORLD, SHADER_FORWARDHDR, SPECULAR_BLINN, TONEMAP_LINEAR } from './constants.js';
import { createBox } from './procedural.js';
import { GraphNode } from './graph-node.js';
import { Material } from './materials/material.js';
import { MeshInstance } from './mesh-instance.js';
import { Model } from './model.js';
import { StandardMaterial } from './materials/standard-material.js';
import { Quat } from '../math/quat.js';
import { Mat4 } from '../math/mat4.js';

/**
 * @class
 * @name pc.Scene
 * @augments pc.EventHandler
 * @classdesc A scene is graphical representation of an environment. It manages the
 * scene hierarchy, all graphical objects, lights, and scene-wide properties.
 * @description Creates a new Scene.
 * @property {pc.Color} ambientLight The color of the scene's ambient light. Defaults
 * to black (0, 0, 0).
 * @property {string} fog The type of fog used by the scene. Can be:
 *
 * * {@link pc.FOG_NONE}
 * * {@link pc.FOG_LINEAR}
 * * {@link pc.FOG_EXP}
 * * {@link pc.FOG_EXP2}
 *
 * Defaults to pc.FOG_NONE.
 * @property {pc.Color} fogColor The color of the fog (if enabled). Defaults to black
 * (0, 0, 0).
 * @property {number} fogDensity The density of the fog (if enabled). This property
 * is only valid if the fog property is set to pc.FOG_EXP or pc.FOG_EXP2. Defaults to 0.
 * @property {number} fogEnd The distance from the viewpoint where linear fog reaches
 * its maximum. This property is only valid if the fog property is set to pc.FOG_LINEAR.
 * Defaults to 1000.
 * @property {number} fogStart The distance from the viewpoint where linear fog begins.
 * This property is only valid if the fog property is set to pc.FOG_LINEAR. Defaults to 1.
 * @property {number} gammaCorrection The gamma correction to apply when rendering the
 * scene. Can be:
 *
 * * {@link pc.GAMMA_NONE}
 * * {@link pc.GAMMA_SRGB}
 *
 * Defaults to pc.GAMMA_NONE.
 * @property {number} toneMapping The tonemapping transform to apply when writing
 * fragments to the frame buffer. Can be:
 *
 * * {@link pc.TONEMAP_LINEAR}
 * * {@link pc.TONEMAP_FILMIC}
 * * {@link pc.TONEMAP_HEJL}
 * * {@link pc.TONEMAP_ACES}
 *
 * Defaults to pc.TONEMAP_LINEAR.
 * @property {number} exposure The exposure value tweaks the overall brightness of
 * the scene. Defaults to 1.
 * @property {pc.Texture} skybox The base cubemap texture used as the scene's skybox, if mip level is 0. Defaults to null.
 * @property {pc.Texture} skyboxPrefiltered128 The prefiltered cubemap texture (size 128x128) used as the scene's skybox, if mip level 1. Defaults to null.
 * @property {pc.Texture} skyboxPrefiltered64 The prefiltered cubemap texture (size 64x64) used as the scene's skybox, if mip level 2. Defaults to null.
 * @property {pc.Texture} skyboxPrefiltered32 The prefiltered cubemap texture (size 32x32) used as the scene's skybox, if mip level 3. Defaults to null.
 * @property {pc.Texture} skyboxPrefiltered16 The prefiltered cubemap texture (size 16x16) used as the scene's skybox, if mip level 4. Defaults to null.
 * @property {pc.Texture} skyboxPrefiltered8 The prefiltered cubemap texture (size 8x8) used as the scene's skybox, if mip level 5. Defaults to null.
 * @property {pc.Texture} skyboxPrefiltered4 The prefiltered cubemap texture (size 4x4) used as the scene's skybox, if mip level 6. Defaults to null.
 * @property {number} skyboxIntensity Multiplier for skybox intensity. Defaults to 1.
 * @property {pc.Quat} skyboxRotation The rotation of the skybox to be displayed. Defaults to {@link pc.Quat.IDENTITY}.
 * @property {number} skyboxMip The mip level of the skybox to be displayed. Only valid
 * for prefiltered cubemap skyboxes. Defaults to 0 (base level).
 * @property {number} lightmapSizeMultiplier The lightmap resolution multiplier.
 * Defaults to 1.
 * @property {number} lightmapMaxResolution The maximum lightmap resolution. Defaults to
 * 2048.
 * @property {number} lightmapMode The lightmap baking mode. Can be:
 *
 * * {@link pc.BAKE_COLOR}: single color lightmap
 * * {@link pc.BAKE_COLORDIR}: single color lightmap + dominant light direction (used for
 * bump/specular). Only lights with bakeDir=true will be used for generating the dominant
 * light direction.
 *
 * Defaults to pc.BAKE_COLORDIR.
 * @property {pc.LayerComposition} layers A {@link pc.LayerComposition} that defines
 * rendering order of this scene.
 * @property {pc.StandardMaterial} defaultMaterial The default material used in case no
 * other material is available.
 * @property {pc.Entity} root The root entity of the scene, which is usually the only
 * child to the Application root entity.
 */
class Scene extends EventHandler {
    constructor() {
        super();

        this.root = null;

        this._gravity = new Vec3(0, -9.8, 0);

        this._layers = null;

        this._fog = FOG_NONE;
        this.fogColor = new Color(0, 0, 0);
        this.fogStart = 1;
        this.fogEnd = 1000;
        this.fogDensity = 0;

        this.ambientLight = new Color(0, 0, 0);

        this._gammaCorrection = GAMMA_NONE;
        this._toneMapping = 0;
        this.exposure = 1.0;

        this._skyboxPrefiltered = [null, null, null, null, null, null];

        this._firstUpdateSkybox = true;
        this._skyboxCubeMap = null;
        this.skyboxModel = null;

        this._skyboxIntensity = 1;
        this._skyboxMip = 0;

        this._skyboxRotation = new Quat();
        this._skyboxRotationMat3 = null;
        this._skyboxRotationMat4 = null;

        this._skyboxIsRenderTarget = false;

        this.lightmapSizeMultiplier = 1;
        this.lightmapMaxResolution = 2048;
        this.lightmapMode = BAKE_COLORDIR;

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
            updateShadersTime: 0 // deprecated
        };

        this.updateShaders = true;
        this.updateSkybox = true;

        this._shaderVersion = 0;
        this._statsUpdated = false;

        // backwards compatibility only
        this._models = [];

        // default material used in case no other material is available
        this.defaultMaterial = new StandardMaterial();
        this.defaultMaterial.name = "Default Material";
        this.defaultMaterial.shadingModel = SPECULAR_BLINN;
    }

    destroy() {
        this.root = null;
        this.defaultMaterial.destroy();
        this.defaultMaterial = null;
        this.off();
    }

    get fog() {
        return this._fog;
    }

    set fog(type) {
        if (type !== this._fog) {
            this._fog = type;
            this.updateShaders = true;
        }
    }

    get gammaCorrection() {
        return this._gammaCorrection;
    }

    set gammaCorrection(value) {
        if (value !== this._gammaCorrection) {
            this._gammaCorrection = value;
            this.updateShaders = true;
        }
    }

    get toneMapping() {
        return this._toneMapping;
    }

    set toneMapping(value) {
        if (value !== this._toneMapping) {
            this._toneMapping = value;
            this.updateShaders = true;
        }
    }

    get skybox() {
        return this._skyboxCubeMap;
    }

    set skybox(value) {
        this._skyboxCubeMap = value;
        this._resetSkyboxModel();
        this.updateShaders = true;
    }

    get skyboxIntensity() {
        return this._skyboxIntensity;
    }

    set skyboxIntensity(value) {
        this._skyboxIntensity = value;
        this._resetSkyboxModel();
        this.updateShaders = true;
    }

    get skyboxRotation() {
        return this._skyboxRotation;
    }

    set skyboxRotation(value) {
        if (!this._skyboxRotation.equals(value)) {
            this._skyboxRotation.copy(value);
            this._resetSkyboxModel();
            this.updateShaders = true;
        }
    }

    get skyboxMip() {
        return this._skyboxMip;
    }

    set skyboxMip(value) {
        this._skyboxMip = value;
        this._resetSkyboxModel();
        this.updateShaders = true;
    }

    get skyboxPrefiltered128() {
        return this._skyboxPrefiltered[0];
    }

    set skyboxPrefiltered128(value) {
        if (this._skyboxPrefiltered[0] === value)
            return;

        this._skyboxPrefiltered[0] = value;
        this.updateShaders = true;
    }

    get skyboxPrefiltered64() {
        return this._skyboxPrefiltered[1];
    }

    set skyboxPrefiltered64(value) {
        if (this._skyboxPrefiltered[1] === value)
            return;

        this._skyboxPrefiltered[1] = value;
        this.updateShaders = true;
    }

    get skyboxPrefiltered32() {
        return this._skyboxPrefiltered[2];
    }

    set skyboxPrefiltered32(value) {
        if (this._skyboxPrefiltered[2] === value)
            return;

        this._skyboxPrefiltered[2] = value;
        this.updateShaders = true;
    }

    get skyboxPrefiltered16() {
        return this._skyboxPrefiltered[3];
    }

    set skyboxPrefiltered16(value) {
        if (this._skyboxPrefiltered[3] === value)
            return;

        this._skyboxPrefiltered[3] = value;
        this.updateShaders = true;
    }

    get skyboxPrefiltered8() {
        return this._skyboxPrefiltered[4];
    }

    set skyboxPrefiltered8(value) {
        if (this._skyboxPrefiltered[4] === value)
            return;

        this._skyboxPrefiltered[4] = value;
        this.updateShaders = true;
    }

    get skyboxPrefiltered4() {
        return this._skyboxPrefiltered[5];
    }

    set skyboxPrefiltered4(value) {
        if (this._skyboxPrefiltered[5] === value)
            return;

        this._skyboxPrefiltered[5] = value;
        this.updateShaders = true;
    }

    // some backwards compatibility
    // drawCalls will now return list of all active composition mesh instances
    get drawCalls() {
        var drawCalls = this.layers._meshInstances;
        if (!drawCalls.length) {
            this.layers._update();
            drawCalls = this.layers._meshInstances;
        }
        return drawCalls;
    }

    set drawCalls(value) {
    }

    get layers() {
        return this._layers;
    }

    set layers(layers) {
        var prev = this._layers;
        this._layers = layers;
        this.fire("set:layers", prev, layers);
    }

    applySettings(settings) {
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

        if (settings.render.skyboxRotation !== undefined) {
            this._skyboxRotation.setFromEulerAngles(settings.render.skyboxRotation[0], settings.render.skyboxRotation[1], settings.render.skyboxRotation[2]);
        }

        this._resetSkyboxModel();
        this.updateShaders = true;
    }

    _updateSkybox(device) {
        // Create skybox
        if (!this.skyboxModel) {

            // skybox selection for some reason has always skipped the 32x32 mipmap, presumably a bug.
            // we can't simply fix this and map 3 to the correct level, since doing so has the potential
            // to change the look of existing scenes dramatically.
            // NOTE: the table skips the 32x32 mipmap
            var skyboxMapping = [0, 1, 3, 4, 5, 6];

            // select which texture to use for the backdrop
            var usedTex =
                this._skyboxMip ?
                    this._skyboxPrefiltered[skyboxMapping[this._skyboxMip]] || this._skyboxPrefiltered[0] || this._skyboxCubeMap :
                    this._skyboxCubeMap || this._skyboxPrefiltered[0];
            if (!usedTex) {
                return;
            }

            if (usedTex._isRenderTarget) {
                this._skyboxIsRenderTarget = true;
            } else {
                this._skyboxIsRenderTarget = false;
            }

            var material = new Material();
            var scene = this;
            material.updateShader = function (dev, sc, defs, staticLightList, pass) {
                var library = device.getProgramLibrary();
                var shader = library.getProgram('skybox', {
                    rgbm: usedTex.type === TEXTURETYPE_RGBM,
                    hdr: (usedTex.type === TEXTURETYPE_RGBM || usedTex.format === PIXELFORMAT_RGBA32F),
                    useIntensity: scene.skyboxIntensity !== 1,
                    useCubeMapRotation: !scene.skyboxRotation.equals(Quat.IDENTITY),
                    useRightHandedCubeMap: scene._skyboxIsRenderTarget,
                    mip: usedTex.fixCubemapSeams ? scene.skyboxMip : 0,
                    fixSeams: usedTex.fixCubemapSeams,
                    gamma: (pass === SHADER_FORWARDHDR ? (scene.gammaCorrection ? GAMMA_SRGBHDR : GAMMA_NONE) : scene.gammaCorrection),
                    toneMapping: (pass === SHADER_FORWARDHDR ? TONEMAP_LINEAR : scene.toneMapping)
                });
                this.shader = shader;
            };

            material.updateShader();
            material.setParameter("texture_cubeMap", usedTex);

            if (!this.skyboxRotation.equals(Quat.IDENTITY)) {
                if (!this._skyboxRotationMat4) this._skyboxRotationMat4 = new Mat4();
                if (!this._skyboxRotationMat3) this._skyboxRotationMat3 = new Mat3();
                this._skyboxRotationMat4.setTRS(pc.Vec3.ZERO, this._skyboxRotation, pc.Vec3.ONE);
                this._skyboxRotationMat4.invertTo3x3(this._skyboxRotationMat3);
                material.setParameter("cubeMapRotationMatrix", this._skyboxRotationMat3.data);
            }

            material.cull = CULLFACE_FRONT;
            material.depthWrite = false;

            var skyLayer = this.layers.getLayerById(LAYERID_SKYBOX);
            if (skyLayer) {
                var node = new GraphNode();
                var mesh = createBox(device);
                var meshInstance = new MeshInstance(node, mesh, material);
                meshInstance.cull = false;
                meshInstance._noDepthDrawGl1 = true;

                var model = new Model();
                model.graph = node;
                model.meshInstances = [meshInstance];
                this.skyboxModel = model;

                skyLayer.addMeshInstances(model.meshInstances);
                this.skyLayer = skyLayer;

                // enable the layer on first skybox update (the skybox layer is created disabled)
                if (this._firstUpdateSkybox) {
                    skyLayer.enabled = true;
                    this._firstUpdateSkybox = false;
                }

                this.fire("set:skybox", usedTex);
            }
        }
    }

    _resetSkyboxModel() {
        if (this.skyboxModel) {
            this.skyLayer.removeMeshInstances(this.skyboxModel.meshInstances);
            this.skyboxModel.destroy();
        }
        this.skyboxModel = null;
        this.updateSkybox = true;
    }

    /**
     * @function
     * @name pc.Scene#setSkybox
     * @description Sets the cubemap for the scene skybox.
     * @param {pc.Texture[]} [cubemaps] - An array of cubemaps corresponding to the skybox at different mip levels. If undefined, scene will remove skybox.
     * Cubemap array should be of size 7, with the first element (index 0) corresponding to the base cubemap (mip level 0) with original resolution.
     * Each remaining element (index 1-6) corresponds to a fixed prefiltered resolution (128x128, 64x64, 32x32, 16x16, 8x8, 4x4).
     */
    setSkybox(cubemaps) {
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
    }

    destroy = function () {
        this.skybox = null;
    }

    // Backwards compatibility
    addModel(model) {
        if (this.containsModel(model)) return;
        var layer = this.layers.getLayerById(LAYERID_WORLD);
        if (!layer) return;
        layer.addMeshInstances(model.meshInstances);
        this._models.push(model);
    }

    addShadowCaster(model) {
        var layer = this.layers.getLayerById(LAYERID_WORLD);
        if (!layer) return;
        layer.addShadowCasters(model.meshInstances);
    }

    removeModel(model) {
        var index = this._models.indexOf(model);
        if (index !== -1) {
            var layer = this.layers.getLayerById(LAYERID_WORLD);
            if (!layer) return;
            layer.removeMeshInstances(model.meshInstances);
            this._models.splice(index, 1);
        }
    }

    removeShadowCasters(model) {
        var layer = this.layers.getLayerById(LAYERID_WORLD);
        if (!layer) return;
        layer.removeShadowCasters(model.meshInstances);
    }

    containsModel(model) {
        return this._models.indexOf(model) >= 0;
    }

    getModels(model) {
        return this._models;
    }

    /**
     * @event
     * @name pc.Scene#set:skybox
     * @description Fired when the skybox is set.
     * @param {pc.Texture} usedTex - Previously used cubemap texture. New is in the {@link pc.Scene#skybox}.
     */

    /**
     * @event
     * @name pc.Scene#set:layers
     * @description Fired when the layer composition is set. Use this event to add callbacks or advanced properties to your layers.
     * @param {pc.LayerComposition} oldComp - Previously used {@link pc.LayerComposition}.
     * @param {pc.LayerComposition} newComp - Newly set {@link pc.LayerComposition}.
     * @example
     * this.app.scene.on('set:layers', function (oldComp, newComp) {
     *     var list = newComp.layerList;
     *     var layer;
     *     for (var i = 0; i < list.length; i++) {
     *         layer = list[i];
     *         switch (layer.name) {
     *             case 'MyLayer':
     *                 layer.onEnable = myOnEnableFunction;
     *                 layer.onDisable = myOnDisableFunction;
     *                 break;
     *             case 'MyOtherLayer':
     *                 layer.shaderPass = myShaderPass;
     *                 break;
     *         }
     *     }
     * });
     */
}

export { Scene };
