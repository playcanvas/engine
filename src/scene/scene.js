import { Debug } from '../core/debug.js';
import { EventHandler } from '../core/event-handler.js';
import { Color } from '../core/math/color.js';
import { Vec3 } from '../core/math/vec3.js';
import { Quat } from '../core/math/quat.js';
import { math } from '../core/math/math.js';
import { Mat3 } from '../core/math/mat3.js';
import { Mat4 } from '../core/math/mat4.js';

import { GraphicsDeviceAccess } from '../platform/graphics/graphics-device-access.js';
import { PIXELFORMAT_RGBA8, ADDRESS_REPEAT, ADDRESS_CLAMP_TO_EDGE, FILTER_LINEAR } from '../platform/graphics/constants.js';

import { BAKE_COLORDIR, FOG_NONE, GAMMA_SRGB, LAYERID_IMMEDIATE } from './constants.js';
import { Sky } from './sky.js';
import { LightingParams } from './lighting/lighting-params.js';
import { Immediate } from './immediate/immediate.js';
import { EnvLighting } from './graphics/env-lighting.js';

/**
 * A scene is graphical representation of an environment. It manages the scene hierarchy, all
 * graphical objects, lights, and scene-wide properties.
 *
 * @augments EventHandler
 */
class Scene extends EventHandler {
    /**
     * If enabled, the ambient lighting will be baked into lightmaps. This will be either the
     * {@link Scene#skybox} if set up, otherwise {@link Scene#ambientLight}. Defaults to false.
     *
     * @type {boolean}
     */
    ambientBake = false;

    /**
     * If {@link Scene#ambientBake} is true, this specifies the brightness of ambient occlusion.
     * Typical range is -1 to 1. Defaults to 0, representing no change to brightness.
     *
     * @type {number}
     */
    ambientBakeOcclusionBrightness = 0;

     /**
      * If {@link Scene#ambientBake} is true, this specifies the contrast of ambient occlusion.
      * Typical range is -1 to 1. Defaults to 0, representing no change to contrast.
      *
      * @type {number}
      */
    ambientBakeOcclusionContrast = 0;

    /**
     * The color of the scene's ambient light. Defaults to black (0, 0, 0).
     *
     * @type {Color}
     */
    ambientLight = new Color(0, 0, 0);

    /**
     * The luminosity of the scene's ambient light in lux (lm/m^2). Used if physicalUnits is true. Defaults to 0.
     *
     * @type {number}
     */
    ambientLuminance = 0;

    /**
     * The exposure value tweaks the overall brightness of the scene. Ignored if physicalUnits is true. Defaults to 1.
     *
     * @type {number}
     */
    exposure = 1;

    /**
     * The color of the fog (if enabled). Defaults to black (0, 0, 0).
     *
     * @type {Color}
     */
    fogColor = new Color(0, 0, 0);

    /**
     * The density of the fog (if enabled). This property is only valid if the fog property is set
     * to {@link FOG_EXP} or {@link FOG_EXP2}. Defaults to 0.
     *
     * @type {number}
     */
    fogDensity = 0;

    /**
     * The distance from the viewpoint where linear fog reaches its maximum. This property is only
     * valid if the fog property is set to {@link FOG_LINEAR}. Defaults to 1000.
     *
     * @type {number}
     */
    fogEnd = 1000;

    /**
     * The distance from the viewpoint where linear fog begins. This property is only valid if the
     * fog property is set to {@link FOG_LINEAR}. Defaults to 1.
     *
     * @type {number}
     */
    fogStart = 1;

    /**
     * The lightmap resolution multiplier. Defaults to 1.
     *
     * @type {number}
     */
    lightmapSizeMultiplier = 1;

    /**
     * The maximum lightmap resolution. Defaults to 2048.
     *
     * @type {number}
     */
    lightmapMaxResolution = 2048;

    /**
     * The lightmap baking mode. Can be:
     *
     * - {@link BAKE_COLOR}: single color lightmap
     * - {@link BAKE_COLORDIR}: single color lightmap + dominant light direction (used for bump or
     * specular). Only lights with bakeDir=true will be used for generating the dominant light
     * direction.
     *
     * Defaults to {@link BAKE_COLORDIR}.
     *
     * @type {number}
     */
    lightmapMode = BAKE_COLORDIR;

    /**
     * Enables bilateral filter on runtime baked color lightmaps, which removes the noise and
     * banding while preserving the edges. Defaults to false. Note that the filtering takes place
     * in the image space of the lightmap, and it does not filter across lightmap UV space seams,
     * often making the seams more visible. It's important to balance the strength of the filter
     * with number of samples used for lightmap baking to limit the visible artifacts.
     *
     * @type {boolean}
     */
    lightmapFilterEnabled = false;

    /**
     * Enables HDR lightmaps. This can result in smoother lightmaps especially when many samples
     * are used. Defaults to false.
     *
     * @type {boolean}
     */
    lightmapHDR = false;

    /**
     * The root entity of the scene, which is usually the only child to the {@link Application}
     * root entity.
     *
     * @type {import('../framework/entity.js').Entity}
     */
    root = null;

    /**
     * The sky of the scene.
     *
     * @type {Sky}
     * @ignore
     */
    sky = null;

    /**
     * Use physically based units for cameras and lights. When used, the exposure value is ignored.
     *
     * @type {boolean}
     */
    physicalUnits = false;

    /**
     * Create a new Scene instance.
     *
     * @param {import('../platform/graphics/graphics-device.js').GraphicsDevice} graphicsDevice -
     * The graphics device used to manage this scene.
     * @hideconstructor
     */
    constructor(graphicsDevice) {
        super();

        Debug.assertDeprecated(graphicsDevice, "Scene constructor takes a GraphicsDevice as a parameter, and it was not provided.");
        this.device = graphicsDevice || GraphicsDeviceAccess.get();

        this._gravity = new Vec3(0, -9.8, 0);

        /**
         * @type {import('./composition/layer-composition.js').LayerComposition}
         * @private
         */
        this._layers = null;

        this._fog = FOG_NONE;

        this._gammaCorrection = GAMMA_SRGB;
        this._toneMapping = 0;

        /**
         * The skybox cubemap as set by user (gets used when skyboxMip === 0)
         *
         * @type {import('../platform/graphics/texture.js').Texture}
         * @private
         */
        this._skyboxCubeMap = null;

        /**
         * Array of 6 prefiltered lighting data cubemaps.
         *
         * @type {import('../platform/graphics/texture.js').Texture[]}
         * @private
         */
        this._prefilteredCubemaps = [null, null, null, null, null, null];

        /**
         * Environment lighting atlas
         *
         * @type {import('../platform/graphics/texture.js').Texture}
         * @private
         */
        this._envAtlas = null;

        // internally generated envAtlas owned by the scene
        this._internalEnvAtlas = null;

        this._skyboxIntensity = 1;
        this._skyboxLuminance = 0;
        this._skyboxMip = 0;

        this._skyboxRotation = new Quat();
        this._skyboxRotationMat3 = new Mat3();
        this._skyboxRotationMat4 = new Mat4();

        // ambient light lightmapping properties
        this._ambientBakeNumSamples = 1;
        this._ambientBakeSpherePart = 0.4;

        this._lightmapFilterRange = 10;
        this._lightmapFilterSmoothness = 0.2;

        // clustered lighting
        this._clusteredLightingEnabled = true;
        this._lightingParams = new LightingParams(this.device.supportsAreaLights, this.device.maxTextureSize, () => {
            this._layers._dirtyLights = true;
        });

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

        /**
         * This flag indicates changes were made to the scene which may require recompilation of
         * shaders that reference global settings.
         *
         * @type {boolean}
         * @ignore
         */
        this.updateShaders = true;

        this._shaderVersion = 0;
        this._statsUpdated = false;

        // immediate rendering
        this.immediate = new Immediate(this.device);
    }

    /**
     * Fired when the skybox is set.
     *
     * @event Scene#set:skybox
     * @param {import('../platform/graphics/texture.js').Texture} usedTex - Previously used cubemap
     * texture. New is in the {@link Scene#skybox}.
     */

    /**
     * Fired when the layer composition is set. Use this event to add callbacks or advanced
     * properties to your layers.
     *
     * @event Scene#set:layers
     * @param {import('./composition/layer-composition.js').LayerComposition} oldComp - Previously
     * used {@link LayerComposition}.
     * @param {import('./composition/layer-composition.js').LayerComposition} newComp - Newly set
     * {@link LayerComposition}.
     * @example
     * this.app.scene.on('set:layers', function (oldComp, newComp) {
     *     const list = newComp.layerList;
     *     for (let i = 0; i < list.length; i++) {
     *         const layer = list[i];
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

    /**
     * Returns the default layer used by the immediate drawing functions.
     *
     * @type {import('./layer.js').Layer}
     * @private
     */
    get defaultDrawLayer() {
        return this.layers.getLayerById(LAYERID_IMMEDIATE);
    }

    /**
     * If {@link Scene#ambientBake} is true, this specifies the number of samples used to bake the
     * ambient light into the lightmap. Defaults to 1. Maximum value is 255.
     *
     * @type {number}
     */
    set ambientBakeNumSamples(value) {
        this._ambientBakeNumSamples = math.clamp(Math.floor(value), 1, 255);
    }

    get ambientBakeNumSamples() {
        return this._ambientBakeNumSamples;
    }

    /**
     * If {@link Scene#ambientBake} is true, this specifies a part of the sphere which represents
     * the source of ambient light. The valid range is 0..1, representing a part of the sphere from
     * top to the bottom. A value of 0.5 represents the upper hemisphere. A value of 1 represents a
     * full sphere. Defaults to 0.4, which is a smaller upper hemisphere as this requires fewer
     * samples to bake.
     *
     * @type {number}
     */
    set ambientBakeSpherePart(value) {
        this._ambientBakeSpherePart = math.clamp(value, 0.001, 1);
    }

    get ambientBakeSpherePart() {
        return this._ambientBakeSpherePart;
    }

    /**
     * True if the clustered lighting is enabled. Set to false before the first frame is rendered
     * to use non-clustered lighting. Defaults to true.
     *
     * @type {boolean}
     */
    set clusteredLightingEnabled(value) {

        if (!this._clusteredLightingEnabled && value) {
            console.error('Turning on disabled clustered lighting is not currently supported');
            return;
        }

        this._clusteredLightingEnabled = value;
    }

    get clusteredLightingEnabled() {
        return this._clusteredLightingEnabled;
    }

    /**
     * List of all active composition mesh instances. Only for backwards compatibility.
     * TODO: BatchManager is using it - perhaps that could be refactored
     *
     * @type {MeshInstance[]}
     * @private
     */
    set drawCalls(value) {
    }

    get drawCalls() {
        let drawCalls = this.layers._meshInstances;
        if (!drawCalls.length) {
            this.layers._update(this.device, this.clusteredLightingEnabled);
            drawCalls = this.layers._meshInstances;
        }
        return drawCalls;
    }

    /**
     * The environment lighting atlas.
     *
     * @type {import('../platform/graphics/texture.js').Texture}
     */
    set envAtlas(value) {
        if (value !== this._envAtlas) {
            this._envAtlas = value;

            // make sure required options are set up on the texture
            if (value) {
                value.addressU = ADDRESS_REPEAT;
                value.addressV = ADDRESS_CLAMP_TO_EDGE;
                value.minFilter = FILTER_LINEAR;
                value.magFilter = FILTER_LINEAR;
                value.mipmaps = false;
            }

            this.updateShaders = true;
        }
    }

    get envAtlas() {
        return this._envAtlas;
    }

    /**
     * The type of fog used by the scene. Can be:
     *
     * - {@link FOG_NONE}
     * - {@link FOG_LINEAR}
     * - {@link FOG_EXP}
     * - {@link FOG_EXP2}
     *
     * Defaults to {@link FOG_NONE}.
     *
     * @type {string}
     */
    set fog(type) {
        if (type !== this._fog) {
            this._fog = type;
            this.updateShaders = true;
        }
    }

    get fog() {
        return this._fog;
    }

    /**
     * The gamma correction to apply when rendering the scene. Can be:
     *
     * - {@link GAMMA_NONE}
     * - {@link GAMMA_SRGB}
     *
     * Defaults to {@link GAMMA_SRGB}.
     *
     * @type {number}
     */
    set gammaCorrection(value) {
        if (value !== this._gammaCorrection) {
            this._gammaCorrection = value;
            this.updateShaders = true;
        }
    }

    get gammaCorrection() {
        return this._gammaCorrection;
    }

    /**
     * A {@link LayerComposition} that defines rendering order of this scene.
     *
     * @type {import('./composition/layer-composition.js').LayerComposition}
     */
    set layers(layers) {
        const prev = this._layers;
        this._layers = layers;
        this.fire('set:layers', prev, layers);
    }

    get layers() {
        return this._layers;
    }

    /**
     * A {@link LightingParams} that defines lighting parameters.
     *
     * @type {LightingParams}
     */
    get lighting() {
        return this._lightingParams;
    }

    /**
     * A range parameter of the bilateral filter. It's used when {@link Scene#lightmapFilterEnabled}
     * is enabled. Larger value applies more widespread blur. This needs to be a positive non-zero
     * value. Defaults to 10.
     *
     * @type {number}
     */
    set lightmapFilterRange(value) {
        this._lightmapFilterRange = Math.max(value, 0.001);
    }

    get lightmapFilterRange() {
        return this._lightmapFilterRange;
    }

    /**
     * A spatial parameter of the bilateral filter. It's used when {@link Scene#lightmapFilterEnabled}
     * is enabled. Larger value blurs less similar colors. This needs to be a positive non-zero
     * value. Defaults to 0.2.
     *
     * @type {number}
     */
    set lightmapFilterSmoothness(value) {
        this._lightmapFilterSmoothness = Math.max(value, 0.001);
    }

    get lightmapFilterSmoothness() {
        return this._lightmapFilterSmoothness;
    }

    /**
     * Set of 6 prefiltered cubemaps.
     *
     * @type {import('../platform/graphics/texture.js').Texture[]}
     */
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
            this._resetSky();

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

    get prefilteredCubemaps() {
        return this._prefilteredCubemaps;
    }

    /**
     * The base cubemap texture used as the scene's skybox, if mip level is 0. Defaults to null.
     *
     * @type {import('../platform/graphics/texture.js').Texture}
     */
    set skybox(value) {
        if (value !== this._skyboxCubeMap) {
            this._skyboxCubeMap = value;
            this._resetSky();
        }
    }

    get skybox() {
        return this._skyboxCubeMap;
    }

    /**
     * Multiplier for skybox intensity. Defaults to 1. Unused if physical units are used.
     *
     * @type {number}
     */
    set skyboxIntensity(value) {
        if (value !== this._skyboxIntensity) {
            this._skyboxIntensity = value;
            this._resetSky();
        }
    }

    get skyboxIntensity() {
        return this._skyboxIntensity;
    }

    /**
     * Luminance (in lm/m^2) of skybox. Defaults to 0. Only used if physical units are used.
     *
     * @type {number}
     */
    set skyboxLuminance(value) {
        if (value !== this._skyboxLuminance) {
            this._skyboxLuminance = value;
            this._resetSky();
        }
    }

    get skyboxLuminance() {
        return this._skyboxLuminance;
    }

    /**
     * The mip level of the skybox to be displayed. Only valid for prefiltered cubemap skyboxes.
     * Defaults to 0 (base level).
     *
     * @type {number}
     */
    set skyboxMip(value) {
        if (value !== this._skyboxMip) {
            this._skyboxMip = value;
            this._resetSky();
        }
    }

    get skyboxMip() {
        return this._skyboxMip;
    }

    /**
     * The rotation of the skybox to be displayed. Defaults to {@link Quat.IDENTITY}.
     *
     * @type {Quat}
     */
    set skyboxRotation(value) {
        if (!this._skyboxRotation.equals(value)) {
            this._skyboxRotation.copy(value);
            if (value.equals(Quat.IDENTITY)) {
                this._skyboxRotationMat3.setIdentity();
            } else {
                this._skyboxRotationMat4.setTRS(Vec3.ZERO, value, Vec3.ONE);
                this._skyboxRotationMat4.invertTo3x3(this._skyboxRotationMat3);
            }
            this._resetSky();
        }
    }

    get skyboxRotation() {
        return this._skyboxRotation;
    }

    /**
     * The tonemapping transform to apply when writing fragments to the frame buffer. Can be:
     *
     * - {@link TONEMAP_LINEAR}
     * - {@link TONEMAP_FILMIC}
     * - {@link TONEMAP_HEJL}
     * - {@link TONEMAP_ACES}
     *
     * Defaults to {@link TONEMAP_LINEAR}.
     *
     * @type {number}
     */
    set toneMapping(value) {
        if (value !== this._toneMapping) {
            this._toneMapping = value;
            this.updateShaders = true;
        }
    }

    get toneMapping() {
        return this._toneMapping;
    }

    destroy() {
        this._resetSky();
        this.root = null;
        this.off();
    }

    drawLine(start, end, color = Color.WHITE, depthTest = true, layer = this.defaultDrawLayer) {
        const batch = this.immediate.getBatch(layer, depthTest);
        batch.addLines([start, end], [color, color]);
    }

    drawLines(positions, colors, depthTest = true, layer = this.defaultDrawLayer) {
        const batch = this.immediate.getBatch(layer, depthTest);
        batch.addLines(positions, colors);
    }

    drawLineArrays(positions, colors, depthTest = true, layer = this.defaultDrawLayer) {
        const batch = this.immediate.getBatch(layer, depthTest);
        batch.addLinesArrays(positions, colors);
    }

    applySettings(settings) {
        const physics = settings.physics;
        const render = settings.render;

        // settings
        this._gravity.set(physics.gravity[0], physics.gravity[1], physics.gravity[2]);
        this.ambientLight.set(render.global_ambient[0], render.global_ambient[1], render.global_ambient[2]);
        this.ambientLuminance = render.ambientLuminance;
        this._fog = render.fog;
        this.fogColor.set(render.fog_color[0], render.fog_color[1], render.fog_color[2]);
        this.fogStart = render.fog_start;
        this.fogEnd = render.fog_end;
        this.fogDensity = render.fog_density;
        this._gammaCorrection = render.gamma_correction;
        this._toneMapping = render.tonemapping;
        this.lightmapSizeMultiplier = render.lightmapSizeMultiplier;
        this.lightmapMaxResolution = render.lightmapMaxResolution;
        this.lightmapMode = render.lightmapMode;
        this.exposure = render.exposure;
        this._skyboxIntensity = render.skyboxIntensity ?? 1;
        this._skyboxLuminance = render.skyboxLuminance ?? 20000;
        this._skyboxMip = render.skyboxMip ?? 0;

        if (render.skyboxRotation) {
            this.skyboxRotation = (new Quat()).setFromEulerAngles(render.skyboxRotation[0], render.skyboxRotation[1], render.skyboxRotation[2]);
        }

        this.clusteredLightingEnabled = render.clusteredLightingEnabled;
        this.lighting.applySettings(render);

        // bake settings
        [
            'lightmapFilterEnabled',
            'lightmapFilterRange',
            'lightmapFilterSmoothness',
            'ambientBake',
            'ambientBakeNumSamples',
            'ambientBakeSpherePart',
            'ambientBakeOcclusionBrightness',
            'ambientBakeOcclusionContrast'
        ].forEach((setting) => {
            if (render.hasOwnProperty(setting)) {
                this[setting] = render[setting];
            }
        });

        this._resetSky();
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

    _updateSky(device) {
        if (!this.sky) {
            const texture = this._getSkyboxTex();
            if (texture) {
                this.sky = new Sky(device, this, texture);
                this.fire('set:skybox', texture);
            }
        }
    }

    _resetSky() {
        this.sky?.destroy();
        this.sky = null;
        this.updateShaders = true;
    }

    /**
     * Sets the cubemap for the scene skybox.
     *
     * @param {import('../platform/graphics/texture.js').Texture[]} [cubemaps] - An array of
     * cubemaps corresponding to the skybox at different mip levels. If undefined, scene will
     * remove skybox. Cubemap array should be of size 7, with the first element (index 0)
     * corresponding to the base cubemap (mip level 0) with original resolution. Each remaining
     * element (index 1-6) corresponds to a fixed prefiltered resolution (128x128, 64x64, 32x32,
     * 16x16, 8x8, 4x4).
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

    /**
     * The lightmap pixel format.
     *
     * @type {number}
     */
    get lightmapPixelFormat() {
        return this.lightmapHDR && this.device.getHdrFormat(false, true, false, true) || PIXELFORMAT_RGBA8;
    }
}

export { Scene };
