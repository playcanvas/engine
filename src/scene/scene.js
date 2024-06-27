import { Debug } from '../core/debug.js';
import { EventHandler } from '../core/event-handler.js';
import { Color } from '../core/math/color.js';
import { Vec3 } from '../core/math/vec3.js';
import { Quat } from '../core/math/quat.js';
import { math } from '../core/math/math.js';
import { Mat3 } from '../core/math/mat3.js';
import { Mat4 } from '../core/math/mat4.js';

import { PIXELFORMAT_RGBA8, ADDRESS_CLAMP_TO_EDGE, FILTER_LINEAR } from '../platform/graphics/constants.js';

import { BAKE_COLORDIR, FOG_NONE, LAYERID_IMMEDIATE } from './constants.js';
import { LightingParams } from './lighting/lighting-params.js';
import { Sky } from './skybox/sky.js';
import { Immediate } from './immediate/immediate.js';
import { EnvLighting } from './graphics/env-lighting.js';
import { RenderingParams } from './renderer/rendering-params.js';

/**
 * A scene is graphical representation of an environment. It manages the scene hierarchy, all
 * graphical objects, lights, and scene-wide properties.
 *
 * @category Graphics
 */
class Scene extends EventHandler {
    /**
     * Fired when the layer composition is set. Use this event to add callbacks or advanced
     * properties to your layers. The handler is passed the old and the new
     * {@link LayerComposition}.
     *
     * @event
     * @example
     * app.scene.on('set:layers', (oldComp, newComp) => {
     *     const list = newComp.layerList;
     *     for (let i = 0; i < list.length; i++) {
     *         const layer = list[i];
     *         switch (layer.name) {
     *             case 'MyLayer':
     *                 layer.onEnable = myOnEnableFunction;
     *                 layer.onDisable = myOnDisableFunction;
     *                 break;
     *             case 'MyOtherLayer':
     *                 layer.clearColorBuffer = true;
     *                 break;
     *         }
     *     }
     * });
     */
    static EVENT_SETLAYERS = 'set:layers';

    /**
     * Fired when the skybox is set. The handler is passed the {@link Texture} that is the
     * previously used skybox cubemap texture. The new skybox cubemap texture is in the
     * {@link Scene#skybox} property.
     *
     * @event
     * @example
     * app.scene.on('set:skybox', (oldSkybox) => {
     *     console.log(`Skybox changed from ${oldSkybox.name} to ${app.scene.skybox.name}`);
     * });
     */
    static EVENT_SETSKYBOX = 'set:skybox';

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
     * The color of the scene's ambient light, specified in sRGB color space. Defaults to black
     * (0, 0, 0).
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
     * The color of the fog (if enabled), specified in sRGB color space. Defaults to black (0, 0, 0).
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
     * Use physically based units for cameras and lights. When used, the exposure value is ignored.
     *
     * @type {boolean}
     */
    physicalUnits = false;

    /**
     * Environment lighting atlas
     *
     * @type {import('../platform/graphics/texture.js').Texture|null}
     * @private
     */
    _envAtlas = null;

    /**
     * The skybox cubemap as set by user (gets used when skyboxMip === 0)
     *
     * @type {import('../platform/graphics/texture.js').Texture|null}
     * @private
     */
    _skyboxCubeMap = null;

    /**
     * The rendering parameters.
     *
     * @private
     */
    _renderingParams = new RenderingParams();

    /**
     * Create a new Scene instance.
     *
     * @param {import('../platform/graphics/graphics-device.js').GraphicsDevice} graphicsDevice -
     * The graphics device used to manage this scene.
     * @ignore
     */
    constructor(graphicsDevice) {
        super();

        Debug.assert(graphicsDevice, "Scene constructor takes a GraphicsDevice as a parameter, and it was not provided.");
        this.device = graphicsDevice;

        this._gravity = new Vec3(0, -9.8, 0);

        /**
         * @type {import('./composition/layer-composition.js').LayerComposition}
         * @private
         */
        this._layers = null;

        this._fog = FOG_NONE;

        /**
         * Array of 6 prefiltered lighting data cubemaps.
         *
         * @type {import('../platform/graphics/texture.js').Texture[]}
         * @private
         */
        this._prefilteredCubemaps = [];

        // internally generated envAtlas owned by the scene
        this._internalEnvAtlas = null;

        this._skyboxIntensity = 1;
        this._skyboxLuminance = 0;
        this._skyboxMip = 0;

        this._skyboxRotationShaderInclude = false;
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
            this.updateShaders = true;
        });

        // skybox
        this._sky = new Sky(this);

        this._stats = {
            meshInstances: 0,
            lights: 0,
            dynamicLights: 0,
            bakedLights: 0,
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

        // immediate rendering
        this.immediate = new Immediate(this.device);
    }

    /**
     * Gets the default layer used by the immediate drawing functions.
     *
     * @type {import('./layer.js').Layer}
     * @ignore
     */
    get defaultDrawLayer() {
        return this.layers.getLayerById(LAYERID_IMMEDIATE);
    }

    /**
     * Sets the number of samples used to bake the ambient light into the lightmap. Note that
     * {@link Scene#ambientBake} must be true for this to have an effect. Defaults to 1. Maximum
     * value is 255.
     *
     * @type {number}
     */
    set ambientBakeNumSamples(value) {
        this._ambientBakeNumSamples = math.clamp(Math.floor(value), 1, 255);
    }

    /**
     * Gets the number of samples used to bake the ambient light into the lightmap.
     *
     * @type {number}
     */
    get ambientBakeNumSamples() {
        return this._ambientBakeNumSamples;
    }

    /**
     * Sets the part of the sphere which represents the source of ambient light. Note that
     * {@link Scene#ambientBake} must be true for this to have an effect. The valid range is 0..1,
     * representing a part of the sphere from top to the bottom. A value of 0.5 represents the
     * upper hemisphere. A value of 1 represents a full sphere. Defaults to 0.4, which is a smaller
     * upper hemisphere as this requires fewer samples to bake.
     *
     * @type {number}
     */
    set ambientBakeSpherePart(value) {
        this._ambientBakeSpherePart = math.clamp(value, 0.001, 1);
    }

    /**
     * Gets the part of the sphere which represents the source of ambient light.
     *
     * @type {number}
     */
    get ambientBakeSpherePart() {
        return this._ambientBakeSpherePart;
    }

    /**
     * Sets whether clustered lighting is enabled. Set to false before the first frame is rendered
     * to use non-clustered lighting. Defaults to true.
     *
     * @type {boolean}
     */
    set clusteredLightingEnabled(value) {

        if (this.device.isWebGPU && !value) {
            Debug.warnOnce('WebGPU currently only supports clustered lighting, and this cannot be disabled.');
            return;
        }

        if (!this._clusteredLightingEnabled && value) {
            console.error('Turning on disabled clustered lighting is not currently supported');
            return;
        }

        this._clusteredLightingEnabled = value;
    }

    /**
     * Gets whether clustered lighting is enabled.
     *
     * @type {boolean}
     */
    get clusteredLightingEnabled() {
        return this._clusteredLightingEnabled;
    }

    /**
     * Sets the environment lighting atlas.
     *
     * @type {import('../platform/graphics/texture.js').Texture}
     */
    set envAtlas(value) {
        if (value !== this._envAtlas) {
            this._envAtlas = value;

            // make sure required options are set up on the texture
            if (value) {
                value.addressU = ADDRESS_CLAMP_TO_EDGE;
                value.addressV = ADDRESS_CLAMP_TO_EDGE;
                value.minFilter = FILTER_LINEAR;
                value.magFilter = FILTER_LINEAR;
                value.mipmaps = false;
            }

            this._prefilteredCubemaps = [];
            if (this._internalEnvAtlas) {
                this._internalEnvAtlas.destroy();
                this._internalEnvAtlas = null;
            }

            this._resetSkyMesh();
        }
    }

    /**
     * Gets the environment lighting atlas.
     *
     * @type {import('../platform/graphics/texture.js').Texture}
     */
    get envAtlas() {
        return this._envAtlas;
    }

    /**
     * Sets the type of fog used by the scene. Can be:
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

    /**
     * Gets the type of fog used by the scene.
     *
     * @type {string}
     */
    get fog() {
        return this._fog;
    }

    /**
     * Sets the {@link LayerComposition} that defines rendering order of this scene.
     *
     * @type {import('./composition/layer-composition.js').LayerComposition}
     */
    set layers(layers) {
        const prev = this._layers;
        this._layers = layers;
        this.fire('set:layers', prev, layers);
    }

    /**
     * Gets the {@link LayerComposition} that defines rendering order of this scene.
     *
     * @type {import('./composition/layer-composition.js').LayerComposition}
     */
    get layers() {
        return this._layers;
    }

    get sky() {
        return this._sky;
    }

    /**
     * Gets the {@link LightingParams} that define lighting parameters.
     *
     * @type {LightingParams}
     */
    get lighting() {
        return this._lightingParams;
    }

    /**
     * A {@link RenderingParams} that defines rendering parameters.
     *
     * @type {RenderingParams}
     */
    get rendering() {
        return this._renderingParams;
    }

    /**
     * Sets the range parameter of the bilateral filter. It's used when {@link Scene#lightmapFilterEnabled}
     * is enabled. Larger value applies more widespread blur. This needs to be a positive non-zero
     * value. Defaults to 10.
     *
     * @type {number}
     */
    set lightmapFilterRange(value) {
        this._lightmapFilterRange = Math.max(value, 0.001);
    }

    /**
     * Gets the range parameter of the bilateral filter.
     *
     * @type {number}
     */
    get lightmapFilterRange() {
        return this._lightmapFilterRange;
    }

    /**
     * Sets the spatial parameter of the bilateral filter. It's used when {@link Scene#lightmapFilterEnabled}
     * is enabled. Larger value blurs less similar colors. This needs to be a positive non-zero
     * value. Defaults to 0.2.
     *
     * @type {number}
     */
    set lightmapFilterSmoothness(value) {
        this._lightmapFilterSmoothness = Math.max(value, 0.001);
    }

    /**
     * Gets the spatial parameter of the bilateral filter.
     *
     * @type {number}
     */
    get lightmapFilterSmoothness() {
        return this._lightmapFilterSmoothness;
    }

    /**
     * Sets the 6 prefiltered cubemaps acting as the source of image-based lighting.
     *
     * @type {import('../platform/graphics/texture.js').Texture[]}
     */
    set prefilteredCubemaps(value) {
        value = value || [];
        const cubemaps = this._prefilteredCubemaps;
        const changed = cubemaps.length !== value.length || cubemaps.some((c, i) => c !== value[i]);

        if (changed) {
            const complete = value.length === 6 && value.every(c => !!c);

            if (complete) {
                // update env atlas
                this._internalEnvAtlas = EnvLighting.generatePrefilteredAtlas(value, {
                    target: this._internalEnvAtlas
                });

                this._envAtlas = this._internalEnvAtlas;
            } else {
                if (this._internalEnvAtlas) {
                    this._internalEnvAtlas.destroy();
                    this._internalEnvAtlas = null;
                }
                this._envAtlas = null;
            }

            this._prefilteredCubemaps = value.slice();
            this._resetSkyMesh();
        }
    }

    /**
     * Gets the 6 prefiltered cubemaps acting as the source of image-based lighting.
     *
     * @type {import('../platform/graphics/texture.js').Texture[]}
     */
    get prefilteredCubemaps() {
        return this._prefilteredCubemaps;
    }

    /**
     * Sets the base cubemap texture used as the scene's skybox when skyboxMip is 0. Defaults to null.
     *
     * @type {import('../platform/graphics/texture.js').Texture}
     */
    set skybox(value) {
        if (value !== this._skyboxCubeMap) {
            this._skyboxCubeMap = value;
            this._resetSkyMesh();
        }
    }

    /**
     * Gets the base cubemap texture used as the scene's skybox when skyboxMip is 0.
     *
     * @type {import('../platform/graphics/texture.js').Texture}
     */
    get skybox() {
        return this._skyboxCubeMap;
    }

    /**
     * Sets the multiplier for skybox intensity. Defaults to 1. Unused if physical units are used.
     *
     * @type {number}
     */
    set skyboxIntensity(value) {
        if (value !== this._skyboxIntensity) {
            this._skyboxIntensity = value;
            this._resetSkyMesh();
        }
    }

    /**
     * Gets the multiplier for skybox intensity.
     *
     * @type {number}
     */
    get skyboxIntensity() {
        return this._skyboxIntensity;
    }

    /**
     * Sets the luminance (in lm/m^2) of the skybox. Defaults to 0. Only used if physical units are used.
     *
     * @type {number}
     */
    set skyboxLuminance(value) {
        if (value !== this._skyboxLuminance) {
            this._skyboxLuminance = value;
            this._resetSkyMesh();
        }
    }

    /**
     * Gets the luminance (in lm/m^2) of the skybox.
     *
     * @type {number}
     */
    get skyboxLuminance() {
        return this._skyboxLuminance;
    }

    /**
     * Sets the mip level of the skybox to be displayed. Only valid for prefiltered cubemap skyboxes.
     * Defaults to 0 (base level).
     *
     * @type {number}
     */
    set skyboxMip(value) {
        if (value !== this._skyboxMip) {
            this._skyboxMip = value;
            this._resetSkyMesh();
        }
    }

    /**
     * Gets the mip level of the skybox to be displayed.
     *
     * @type {number}
     */
    get skyboxMip() {
        return this._skyboxMip;
    }

    /**
     * Sets the rotation of the skybox to be displayed. Defaults to {@link Quat.IDENTITY}.
     *
     * @type {Quat}
     */
    set skyboxRotation(value) {
        if (!this._skyboxRotation.equals(value)) {

            const isIdentity = value.equals(Quat.IDENTITY);
            this._skyboxRotation.copy(value);

            if (isIdentity) {
                this._skyboxRotationMat3.setIdentity();
            } else {
                this._skyboxRotationMat4.setTRS(Vec3.ZERO, value, Vec3.ONE);
                this._skyboxRotationMat3.invertMat4(this._skyboxRotationMat4);
            }

            // only reset sky / rebuild scene shaders if rotation changed away from identity for the first time
            if (!this._skyboxRotationShaderInclude && !isIdentity) {
                this._skyboxRotationShaderInclude = true;
                this._resetSkyMesh();
            }
        }
    }

    /**
     * Gets the rotation of the skybox to be displayed.
     *
     * @type {Quat}
     */
    get skyboxRotation() {
        return this._skyboxRotation;
    }

    destroy() {
        this._resetSkyMesh();
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
        this._renderingParams.gammaCorrection = render.gamma_correction;
        this._renderingParams.toneMapping = render.tonemapping;
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

        this.sky.applySettings(render);

        this.clusteredLightingEnabled = render.clusteredLightingEnabled ?? false;
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

        this._resetSkyMesh();
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

    _updateSkyMesh() {
        if (!this.sky.skyMesh) {
            this.sky.updateSkyMesh();
        }
        this.sky.update();
    }

    _resetSkyMesh() {
        this.sky.resetSkyMesh();
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
            this.envAtlas = null;
        } else {
            this.skybox = cubemaps[0] || null;
            if (cubemaps[1] && !cubemaps[1].cubemap) {
                // prefiltered data is an env atlas
                this.envAtlas = cubemaps[1];
            } else {
                // prefiltered data is a set of cubemaps
                this.prefilteredCubemaps = cubemaps.slice(1);
            }
        }
    }

    /**
     * Gets the lightmap pixel format.
     *
     * @type {number}
     */
    get lightmapPixelFormat() {
        return this.lightmapHDR && this.device.getRenderableHdrFormat() || PIXELFORMAT_RGBA8;
    }
}

export { Scene };
