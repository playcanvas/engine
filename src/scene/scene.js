import { EventHandler } from '../core/event-handler.js';

import { Color } from '../math/color.js';
import { Mat3 } from '../math/mat3.js';
import { Mat4 } from '../math/mat4.js';
import { Vec3 } from '../math/vec3.js';
import { Quat } from '../math/quat.js';
import { math } from '../math/math.js';

import { CULLFACE_FRONT, PIXELFORMAT_RGBA32F, TEXTURETYPE_RGBM } from '../graphics/constants.js';

import { BAKE_COLORDIR, FOG_NONE, GAMMA_NONE, GAMMA_SRGBHDR, LAYERID_SKYBOX, LAYERID_WORLD, SHADER_FORWARDHDR, TONEMAP_LINEAR } from './constants.js';
import { createBox } from './procedural.js';
import { GraphNode } from './graph-node.js';
import { Material } from './materials/material.js';
import { MeshInstance } from './mesh-instance.js';
import { Model } from './model.js';
import { EnvLighting } from '../graphics/env-lighting.js';

/**
 * @class
 * @name Scene
 * @augments EventHandler
 * @classdesc A scene is graphical representation of an environment. It manages the
 * scene hierarchy, all graphical objects, lights, and scene-wide properties.
 * @description Creates a new Scene.
 * @property {Color} ambientLight The color of the scene's ambient light. Defaults
 * to black (0, 0, 0).
 * @property {string} fog The type of fog used by the scene. Can be:
 *
 * - {@link FOG_NONE}
 * - {@link FOG_LINEAR}
 * - {@link FOG_EXP}
 * - {@link FOG_EXP2}
 *
 * Defaults to {@link FOG_NONE}.
 * @property {Color} fogColor The color of the fog (if enabled). Defaults to black
 * (0, 0, 0).
 * @property {number} fogDensity The density of the fog (if enabled). This property
 * is only valid if the fog property is set to {@link FOG_EXP} or {@link FOG_EXP2}. Defaults to 0.
 * @property {number} fogEnd The distance from the viewpoint where linear fog reaches
 * its maximum. This property is only valid if the fog property is set to {@link FOG_LINEAR}.
 * Defaults to 1000.
 * @property {number} fogStart The distance from the viewpoint where linear fog begins.
 * This property is only valid if the fog property is set to {@link FOG_LINEAR}. Defaults to 1.
 * @property {number} gammaCorrection The gamma correction to apply when rendering the
 * scene. Can be:
 *
 * - {@link GAMMA_NONE}
 * - {@link GAMMA_SRGB}
 *
 * Defaults to {@link GAMMA_NONE}.
 * @property {number} toneMapping The tonemapping transform to apply when writing
 * fragments to the frame buffer. Can be:
 *
 * - {@link TONEMAP_LINEAR}
 * - {@link TONEMAP_FILMIC}
 * - {@link TONEMAP_HEJL}
 * - {@link TONEMAP_ACES}
 *
 * Defaults to {@link TONEMAP_LINEAR}.
 * @property {number} exposure The exposure value tweaks the overall brightness of
 * the scene. Defaults to 1.
 * @property {Texture} skybox The base cubemap texture used as the scene's skybox, if mip level is 0. Defaults to null.
 * @property {number} skyboxIntensity Multiplier for skybox intensity. Defaults to 1.
 * @property {Quat} skyboxRotation The rotation of the skybox to be displayed. Defaults to {@link Quat.IDENTITY}.
 * @property {number} skyboxMip The mip level of the skybox to be displayed. Only valid
 * for prefiltered cubemap skyboxes. Defaults to 0 (base level).
 * @property {Texture[]} prefilteredCubemaps Set of 6 prefiltered cubemaps.
 * @property {Texture} envAtlas The environment lighting atlas.
 * @property {number} lightmapSizeMultiplier The lightmap resolution multiplier.
 * Defaults to 1.
 * @property {number} lightmapMaxResolution The maximum lightmap resolution. Defaults to
 * 2048.
 * @property {number} lightmapMode The lightmap baking mode. Can be:
 *
 * - {@link BAKE_COLOR}: single color lightmap
 * - {@link BAKE_COLORDIR}: single color lightmap + dominant light direction (used for
 * bump/specular). Only lights with bakeDir=true will be used for generating the dominant
 * light direction.
 *
 * Defaults to {@link BAKE_COLORDIR}.
 * @property {boolean} lightmapFilterEnabled Enables bilateral filter on runtime baked color lightmaps, which removes the noise and banding while preserving the edges. Defaults to false;
 * Note that the filtering takes place in the image space of the lightmap, and it does not filter across lightmap UV space seams, often making the seams more visible. It's important to balance the strength of the filter with number of samples used
 * for lightmap baking to limit the visible artifacts.
 * @property {number} lightmapFilterRange A range parameter of the bilateral filter. It's used when {@link Scene#lightmapFilterEnabled} is enabled. Larger value applies more widespread blur. This needs to be a positive non-zero value. Defaults to 10.
 * @property {number} lightmapFilterSmoothness A spatial parameter of the bilateral filter. It's used when {@link Scene#lightmapFilterEnabled} is enabled. Larger value blurs less similar colors. This needs to be a positive non-zero value. Defaults to 0.2.
 * @property {boolean} ambientBake If enabled, the ambient lighting will be baked into lightmaps. This will be either the {@link Scene#skybox} if set up, otherwise {@link Scene#ambientLight}. Defaults to false.
 * @property {number} ambientBakeNumSamples If {@link Scene#ambientBake} is true, this specifies the number of samples used to bake the ambient light into the lightmap. Defaults to 1. Maximum value is 255.
 * @property {number} ambientBakeSpherePart If {@link Scene#ambientBake} is true, this specifies a part of the sphere which represents the source of ambient light. The valid range is 0..1, representing a part of the sphere from top to the bottom.
 * A value of 0.5 represents the upper hemisphere. A value of 1 represents a full sphere. Defaults to 0.4, which is a smaller upper hemisphere as this requires fewer samples to bake.
 * @property {number} ambientBakeOcclusionContrast If {@link Scene#ambientBake} is true, this specifies the contrast of ambient occlusion. Typical range is -1 to 1. Defaults to 0, representing no change to contrast.
 * @property {number} ambientBakeOcclusionBrightness If {@link Scene#ambientBake} is true, this specifies the brightness of ambient occlusion. Typical range is -1 to 1. Defaults to 0, representing no change to brightness.
 * @property {LayerComposition} layers A {@link LayerComposition} that defines
 * rendering order of this scene.
 * @property {Entity} root The root entity of the scene, which is usually the only
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

        // the skybox cubemap as set by user (gets used when skyboxMip === 0)
        this._skyboxCubeMap = null;

        // prefiltered lighting data cubemaps
        this._prefilteredCubemaps = [null, null, null, null, null, null];

        // environment lighting atlas
        this._envAtlas = null;

        // internally generated envAtlas owned by the scene
        this._internalEnvAtlas = null;

        this.skyboxModel = null;

        this._skyboxIntensity = 1;
        this._skyboxMip = 0;

        this._skyboxRotation = new Quat();
        this._skyboxRotationMat3 = null;
        this._skyboxRotationMat4 = null;

        // ambient light lightmapping properties
        this._ambientBake = false;
        this._ambientBakeNumSamples = 1;
        this._ambientBakeSpherePart = 0.4;
        this.ambientBakeOcclusionContrast = 0;
        this.ambientBakeOcclusionBrightness = 0;

        this.lightmapSizeMultiplier = 1;
        this.lightmapMaxResolution = 2048;
        this.lightmapMode = BAKE_COLORDIR;
        this.lightmapFilterEnabled = false;
        this._lightmapFilterRange = 10;
        this._lightmapFilterSmoothness = 0.2;

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

        // this flag indicates changes were made to the scene which may require
        // recompilation of shaders that reference global settings.
        this.updateShaders = true;

        this._shaderVersion = 0;
        this._statsUpdated = false;

        // backwards compatibility only
        this._models = [];
    }

    destroy() {
        this._resetSkyboxModel();
        this.root = null;
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
        if (value !== this._skyboxCubeMap) {
            this._skyboxCubeMap = value;
            this._resetSkyboxModel();
        }
    }

    get skyboxIntensity() {
        return this._skyboxIntensity;
    }

    set skyboxIntensity(value) {
        if (value !== this._skyboxIntensity) {
            this._skyboxIntensity = value;
            this._resetSkyboxModel();
        }
    }

    get ambientBake() {
        return this._ambientBake;
    }

    set ambientBake(value) {
        this._ambientBake = value;
    }

    get ambientBakeNumSamples() {
        return this._ambientBakeNumSamples;
    }

    set ambientBakeNumSamples(value) {
        this._ambientBakeNumSamples = math.clamp(Math.floor(value), 1, 255);
    }

    get ambientBakeSpherePart() {
        return this._ambientBakeSpherePart;
    }

    set ambientBakeSpherePart(value) {
        this._ambientBakeSpherePart = math.clamp(value, 0.001, 1);
    }

    get lightmapFilterRange() {
        return this._lightmapFilterRange;
    }

    set lightmapFilterRange(value) {
        this._lightmapFilterRange = Math.max(value, 0.001);
    }

    get lightmapFilterSmoothness() {
        return this._lightmapFilterSmoothness;
    }

    set lightmapFilterSmoothness(value) {
        this._lightmapFilterSmoothness = Math.max(value, 0.001);
    }

    get skyboxRotation() {
        return this._skyboxRotation;
    }

    set skyboxRotation(value) {
        if (!this._skyboxRotation.equals(value)) {
            this._skyboxRotation.copy(value);
            this._resetSkyboxModel();
        }
    }

    get skyboxMip() {
        return this._skyboxMip;
    }

    set skyboxMip(value) {
        if (value !== this._skyboxMip) {
            this._skyboxMip = value;
            this._resetSkyboxModel();
        }
    }

    get prefilteredCubemaps() {
        return this._prefilteredCubemaps;
    }

    // set the 6 prefiltered cubemaps
    set prefilteredCubemaps(value) {
        const cubemaps = this._prefilteredCubemaps;

        value = value || [];

        let changed = false;
        let complete = true;
        for (let i = 0; i < 6; ++i) {
            const v = value[i] || null;
            if (cubemaps[i] !== v) {
                cubemaps[i] = v;
                changed = true;
            }
            complete = complete && (!!cubemaps[i]);
        }

        if (changed) {
            this._resetSkyboxModel();

            if (complete) {
                // update env atlas
                this._internalEnvAtlas = EnvLighting.generatePrefilteredAtlas(cubemaps, {
                    target: this._internalEnvAtlas
                });

                if (!this._envAtlas) {
                    // user hasn't set an envAtlas already, set it to the internal one
                    this.envAtlas = this._internalEnvAtlas;
                }
            } else if (this._internalEnvAtlas) {
                if (this._envAtlas === this._internalEnvAtlas) {
                    this.envAtlas = null;
                }
                this._internalEnvAtlas.destroy();
                this._internalEnvAtlas = null;
            }
        }
    }

    get envAtlas() {
        return this._envAtlas;
    }

    set envAtlas(value) {
        if (value !== this._envAtlas) {
            this._envAtlas = value;
            this.updateShaders = true;
        }
    }

    // some backwards compatibility
    // drawCalls will now return list of all active composition mesh instances
    get drawCalls() {
        let drawCalls = this.layers._meshInstances;
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
        const prev = this._layers;
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

        if (settings.render.skyboxRotation) {
            this._skyboxRotation.setFromEulerAngles(settings.render.skyboxRotation[0], settings.render.skyboxRotation[1], settings.render.skyboxRotation[2]);
        }

        this._resetSkyboxModel();
    }

    // get the actual texture to use for skybox rendering
    _getSkyboxTex() {
        const cubemaps = this._prefilteredCubemaps;

        if (this._skyboxMip) {
            // skybox selection for some reason has always skipped the 32x32 prefiltered mipmap, presumably a bug.
            // we can't simply fix this and map 3 to the correct level, since doing so has the potential
            // to change the look of existing scenes dramatically.
            // NOTE: the table skips the 32x32 mipmap
            const skyboxMapping = [0, 1, /* 2 */ 3, 4, 5, 6];

            // select blurry texture for use on the skybox
            return cubemaps[skyboxMapping[this._skyboxMip]] || this._envAtlas || cubemaps[0] || this._skyboxCubeMap;
        }

        return this._skyboxCubeMap || cubemaps[0] || this._envAtlas;
    }

    _updateSkybox(device) {
        if (this.skyboxModel) {
            return;
        }

        // get the used texture
        const skyboxTex = this._getSkyboxTex();
        if (!skyboxTex) {
            return;
        }

        const material = new Material();
        const scene = this;

        material.updateShader = function (dev, sc, defs, staticLightList, pass) {
            const library = device.getProgramLibrary();

            if (skyboxTex.cubemap) {
                this.shader = library.getProgram('skybox', {
                    type: 'cubemap',
                    rgbm: skyboxTex.type === TEXTURETYPE_RGBM,
                    hdr: (skyboxTex.type === TEXTURETYPE_RGBM || skyboxTex.format === PIXELFORMAT_RGBA32F),
                    useIntensity: scene.skyboxIntensity !== 1,
                    mip: skyboxTex.fixCubemapSeams ? scene.skyboxMip : 0,
                    fixSeams: skyboxTex.fixCubemapSeams,
                    gamma: (pass === SHADER_FORWARDHDR ? (scene.gammaCorrection ? GAMMA_SRGBHDR : GAMMA_NONE) : scene.gammaCorrection),
                    toneMapping: (pass === SHADER_FORWARDHDR ? TONEMAP_LINEAR : scene.toneMapping)
                });
            } else {
                this.shader = library.getProgram('skybox', {
                    type: 'envAtlas',
                    encoding: skyboxTex.encoding,
                    useIntensity: scene.skyboxIntensity !== 1,
                    gamma: (pass === SHADER_FORWARDHDR ? (scene.gammaCorrection ? GAMMA_SRGBHDR : GAMMA_NONE) : scene.gammaCorrection),
                    toneMapping: (pass === SHADER_FORWARDHDR ? TONEMAP_LINEAR : scene.toneMapping)
                });
            }
        };

        material.updateShader();

        if (skyboxTex.cubemap) {
            material.setParameter("texture_cubeMap", skyboxTex);
        } else {
            material.setParameter("texture_envAtlas", skyboxTex);
            material.setParameter("mipLevel", this._skyboxMip);
        }

        if (!this.skyboxRotation.equals(Quat.IDENTITY)) {
            if (!this._skyboxRotationMat4) this._skyboxRotationMat4 = new Mat4();
            if (!this._skyboxRotationMat3) this._skyboxRotationMat3 = new Mat3();
            this._skyboxRotationMat4.setTRS(Vec3.ZERO, this._skyboxRotation, Vec3.ONE);
            this._skyboxRotationMat4.invertTo3x3(this._skyboxRotationMat3);
            material.setParameter("cubeMapRotationMatrix", this._skyboxRotationMat3.data);
        } else {
            material.setParameter("cubeMapRotationMatrix", Mat3.IDENTITY.data);
        }

        material.cull = CULLFACE_FRONT;
        material.depthWrite = false;

        const skyLayer = this.layers.getLayerById(LAYERID_SKYBOX);
        if (skyLayer) {
            const node = new GraphNode("Skybox");
            const mesh = createBox(device);
            const meshInstance = new MeshInstance(mesh, material, node);
            meshInstance.cull = false;
            meshInstance._noDepthDrawGl1 = true;

            // disable picker, the material has custom update shader and does not handle picker variant
            meshInstance.pick = false;

            const model = new Model();
            model.graph = node;
            model.meshInstances = [meshInstance];
            this.skyboxModel = model;

            skyLayer.addMeshInstances(model.meshInstances);
            this.skyLayer = skyLayer;

            this.fire("set:skybox", skyboxTex);
        }
    }

    _resetSkyboxModel() {
        if (this.skyboxModel) {
            this.skyLayer.removeMeshInstances(this.skyboxModel.meshInstances);
            this.skyboxModel.destroy();
        }
        this.skyboxModel = null;
        this.updateShaders = true;
    }

    /**
     * @function
     * @name Scene#setSkybox
     * @description Sets the cubemap for the scene skybox.
     * @param {Texture[]} [cubemaps] - An array of cubemaps corresponding to the skybox at different mip levels. If undefined, scene will remove skybox.
     * Cubemap array should be of size 7, with the first element (index 0) corresponding to the base cubemap (mip level 0) with original resolution.
     * Each remaining element (index 1-6) corresponds to a fixed prefiltered resolution (128x128, 64x64, 32x32, 16x16, 8x8, 4x4).
     */
    setSkybox(cubemaps) {
        if (!cubemaps) {
            this.skybox = null;
            this.prefilteredCubemaps = [null, null, null, null, null, null];
        } else {
            this.skybox = cubemaps[0] || null;
            this.prefilteredCubemaps = cubemaps.slice(1);
        }
    }

    // Backwards compatibility
    addModel(model) {
        if (this.containsModel(model)) return;
        const layer = this.layers.getLayerById(LAYERID_WORLD);
        if (!layer) return;
        layer.addMeshInstances(model.meshInstances);
        this._models.push(model);
    }

    addShadowCaster(model) {
        const layer = this.layers.getLayerById(LAYERID_WORLD);
        if (!layer) return;
        layer.addShadowCasters(model.meshInstances);
    }

    removeModel(model) {
        const index = this._models.indexOf(model);
        if (index !== -1) {
            const layer = this.layers.getLayerById(LAYERID_WORLD);
            if (!layer) return;
            layer.removeMeshInstances(model.meshInstances);
            this._models.splice(index, 1);
        }
    }

    removeShadowCasters(model) {
        const layer = this.layers.getLayerById(LAYERID_WORLD);
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
     * @name Scene#set:skybox
     * @description Fired when the skybox is set.
     * @param {Texture} usedTex - Previously used cubemap texture. New is in the {@link Scene#skybox}.
     */

    /**
     * @event
     * @name Scene#set:layers
     * @description Fired when the layer composition is set. Use this event to add callbacks or advanced properties to your layers.
     * @param {LayerComposition} oldComp - Previously used {@link LayerComposition}.
     * @param {LayerComposition} newComp - Newly set {@link LayerComposition}.
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
