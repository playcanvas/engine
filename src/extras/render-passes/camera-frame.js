import { Debug } from '../../core/debug.js';
import { Color } from '../../core/math/color.js';
import { math } from '../../core/math/math.js';
import { PIXELFORMAT_111110F, PIXELFORMAT_RGBA16F, PIXELFORMAT_RGBA32F } from '../../platform/graphics/constants.js';
import { PROJECTION_PERSPECTIVE } from '../../scene/constants.js';
import { SSAOTYPE_NONE } from './constants.js';
import { CasEffect } from './effects/cas-effect.js';
import { ColorEnhanceEffect } from './effects/color-enhance-effect.js';
import { ColorLutEffect } from './effects/color-lut-effect.js';
import { FringingEffect } from './effects/fringing-effect.js';
import { GradingEffect } from './effects/grading-effect.js';
import { VignetteEffect } from './effects/vignette-effect.js';
import { CameraFrameOptions, FramePassCameraFrame } from './frame-pass-camera-frame.js';

/**
 * @import { CameraFrameEffect } from './camera-frame-effect.js'
 * @import { AppBase } from '../../framework/app-base.js'
 * @import { CameraComponent } from '../../framework/components/camera/component.js'
 * @import { GraphicsDevice } from '../../platform/graphics/graphics-device.js'
 * @import { LightComponent } from '../../framework/components/light/component.js'
 */

/**
 * The debug views the composition implements itself, which an effect's debug views must not
 * shadow - see the DEBUG_COMPOSE handling in the compose shader chunk.
 *
 * @type {string[]}
 */
const builtinDebugViews = ['scene', 'ssao', 'bloom', 'dofcoc', 'dofblur', 'depth', 'depthmissing'];

/**
 * @typedef {Object} Rendering
 * Properties related to scene rendering, encompassing settings that control the rendering resolution,
 * pixel format, multi-sampling for anti-aliasing, tone-mapping and similar.
 * @property {number[]} renderFormats - The preferred render formats of the frame buffer, in order of
 * preference. First format from this list that is supported by the hardware is used. When none of
 * the formats are supported, {@link PIXELFORMAT_RGBA8} is used, but this automatically disables
 * bloom effect, which requires HDR format. The list can contain the following formats:
 * {@link PIXELFORMAT_111110F}, {@link PIXELFORMAT_RGBA16F}, {@link PIXELFORMAT_RGBA32F} and {@link
 * PIXELFORMAT_RGBA8}. Typically the default option should be used, which prefers the faster formats,
 * but if higher dynamic range is needed, the list can be adjusted to prefer higher precision formats.
 * Defaults to [{@link PIXELFORMAT_111110F}, {@link PIXELFORMAT_RGBA16F}, {@link PIXELFORMAT_RGBA32F}].
 * @property {boolean} stencil - Whether the render buffer has a stencil buffer. Defaults to false.
 * @property {number} renderTargetScale - The scale of the render target, 0.1-1 range. This allows the
 * scene to be rendered to a lower resolution render target as an optimization. The post-processing
 * is also applied at this lower resolution. The image is then up-scaled to the full resolution and
 * any UI rendering that follows is applied at the full resolution. Defaults to 1 which represents
 * full resolution rendering.
 * @property {number} samples - The number of samples of the {@link RenderTarget} used for the scene
 * rendering, in 1-4 range. Value of 1 disables multisample anti-aliasing, other values enable
 * anti-aliasing, Typically set to 1 when TAA is used, even though both anti-aliasing options can be
 * used together at a higher cost. Defaults to 1.
 * @property {boolean} sceneColorMap - Whether rendering generates a scene color map. Defaults to false.
 * @property {boolean} sceneDepthMap - Whether rendering generates a scene depth map. Defaults to false.
 * @property {number} toneMapping - The tone mapping. Can be:
 *
 * - {@link TONEMAP_LINEAR}
 * - {@link TONEMAP_FILMIC}
 * - {@link TONEMAP_HEJL}
 * - {@link TONEMAP_ACES}
 * - {@link TONEMAP_ACES2}
 * - {@link TONEMAP_NEUTRAL}
 *
 * Defaults to {@link TONEMAP_LINEAR}.
 * @property {number} sharpness - The sharpening intensity, 0-1 range. This can be used to increase
 * the sharpness of the rendered image. Often used to counteract the blurriness of the TAA effect,
 * but also blurriness caused by rendering to a lower resolution render target by using
 * rendering.renderTargetScale property. Defaults to 0.
 */

/**
 * @typedef {Object} Ssao
 * Properties related to the Screen Space Ambient Occlusion (SSAO) effect, a postprocessing technique
 * that approximates ambient occlusion by calculating how exposed each point in the screen space is
 * to ambient light, enhancing depth perception and adding subtle shadowing in crevices and between
 * objects.
 * @property {string} type - The type of the SSAO determines how it is applied in the rendering
 * process. Defaults to {@link SSAOTYPE_NONE}. Can be:
 *
 * - {@link SSAOTYPE_NONE}
 * - {@link SSAOTYPE_LIGHTING}
 * - {@link SSAOTYPE_COMBINE}
 *
 * @property {boolean} blurEnabled - Whether the SSAO effect is blurred. Defaults to true.
 * @property {boolean} randomize - Whether the SSAO sampling is randomized. Useful when used instead
 * of blur effect together with TAA. Defaults to false.
 * @property {number} intensity - The intensity of the SSAO effect, 0-1 range. Defaults to 0.5.
 * @property {number} radius - The radius of the SSAO effect, 0-100 range. Defaults to 30.
 * @property {number} samples - The number of samples of the SSAO effect, 1-64 range. Defaults to 12.
 * @property {number} power - The power of the SSAO effect, 0.1-10 range. Defaults to 6.
 * @property {number} minAngle - The minimum angle of the SSAO effect, 1-90 range. Defaults to 10.
 * @property {number} scale - The scale of the SSAO effect, 0.5-1 range. Defaults to 1.
 */

/**
 * @typedef {Object} Bloom
 * Properties related to the HDR bloom effect, a postprocessing technique that simulates the natural
 * glow of bright light sources by spreading their intensity beyond their boundaries, creating a soft
 * and realistic blooming effect.
 * @property {number} intensity - The intensity of the bloom effect, 0-0.1 range. Defaults to 0,
 * making it disabled.
 * @property {number} blurLevel - The number of iterations for blurring the bloom effect, with each
 * level doubling the blur size. Once the blur size matches the dimensions of the render target,
 * further blur passes are skipped. The default value is 16.
 * @property {number} threshold - The brightness below which the scene does not contribute to
 * bloom. Zero, the default, blooms the whole scene, which is the physically based behaviour;
 * raising it restricts the glow to the brightest parts, with a soft transition below the
 * threshold. The value is in the scene-referred units the scene is rendered in, before the
 * exposure and tone mapping applied when the bloom is composited, so a scene lit for an exposure
 * far from 1 needs the threshold scaled to match.
 */

/**
 * @typedef {Object} Taa
 * Properties related to temporal anti-aliasing (TAA), which is a technique used to reduce aliasing
 * in the rendered image by blending multiple frames together over time.
 * @property {boolean} enabled - Whether TAA is enabled. Defaults to false.
 * @property {number} jitter - The intensity of the camera jitter, 0-1 range. The larger the value,
 * the more jitter is applied to the camera, making the anti-aliasing effect more pronounced. This
 * also makes the image more blurry, and rendering.sharpness parameter can be used to counteract.
 * Defaults to 1.
 */

/**
 * @typedef {Object} Dof
 * Properties related to Depth of Field (DOF), a technique used to simulate the optical effect where
 * objects at certain distances appear sharp while others are blurred, enhancing the perception of
 * focus and depth in the rendered scene.
 * @property {boolean} enabled - Whether DoF is enabled. Defaults to false.
 * @property {boolean} nearBlur - Whether the near blur is enabled. Defaults to false.
 * @property {number} focusDistance - The distance at which the focus is set. Defaults to 100.
 * @property {number} focusRange - The range around the focus distance where the focus is sharp.
 * Defaults to 10.
 * @property {number} blurRadius - The radius of the blur effect, typically 2-10 range. Defaults to 3.
 * @property {number} blurRings - The number of rings in the blur effect, typically 3-8 range. Defaults
 * to 4.
 * @property {number} blurRingPoints - The number of points in each ring of the blur effect, typically
 * 3-8 range. Defaults to 5.
 * @property {boolean} highQuality - Whether the high quality implementation is used. This will have
 * a higher performance cost, but will produce better quality results. Defaults to true.
 */

/**
 * @typedef {Object} VolumetricFog
 * Properties related to volumetric fog, a raymarched height fog lit by a directional light. The
 * fog samples the light's cascaded shadow map along each view ray, forming visible shafts of
 * light. The raymarch runs at a reduced resolution and is blended into the scene before TAA, so
 * when TAA is enabled, its noise is temporally resolved to a smooth result. Optionally the
 * clustered omni and spot lights scatter light in the fog as well, see `localOmniLights` and
 * `localSpotLights`.
 * @property {boolean} enabled - Whether the volumetric fog is enabled. Defaults to false.
 * @property {LightComponent|null} light - The directional light providing the scattered light, or
 * null when the fog is lit by the local lights and the ambient term only. When a light of a type
 * other than directional is assigned, the effect is disabled. Defaults to null.
 * @property {boolean} localOmniLights - Whether the clustered omni lights scatter light in the fog.
 * Each light adds a raymarch over the part of the view rays inside its volume, sampling the shadow
 * and the cookie atlas of the clustered lighting, and so the cost scales with the screen space size
 * of the light volumes. As an omni light fills its whole bounding sphere, its volume is typically
 * much larger on the screen than the volume of a spot light. Requires clustered lighting, which is
 * enabled by default. Individual lights can scatter more or less light using
 * {@link LightComponent#volumetricScattering}. Defaults to false.
 * @property {boolean} localSpotLights - Whether the clustered spot lights scatter light in the fog,
 * forming visible beams. See `localOmniLights` for details, both types are rendered the same way and
 * share the `localIntensity` and `localSteps` settings. Defaults to false.
 * @property {number} localIntensity - The intensity of the light scattering of the local lights.
 * Defaults to 1.
 * @property {number} localSteps - The number of raymarching steps taken inside the volume of each
 * local light, 2-64 range. Defaults to 12.
 * @property {Color} tint - The albedo of the fog. Defaults to white.
 * @property {number} density - The fog density at the base height. Defaults to 0.01.
 * @property {number} heightBase - The world space height at which the fog density starts to fall
 * off. Below it the density is constant. Defaults to 0.
 * @property {number} heightFalloff - The exponential falloff of the fog density with height above
 * the base height. Value of 0 makes the fog uniform. Defaults to 0.05.
 * @property {number} extinction - A scale of how quickly the fog absorbs the light passing through
 * it, without affecting how much light it scatters. A value of 1 is physically consistent, where the
 * fog absorbs as much as it scatters, and distant fog and light shafts fade out exponentially with
 * the density. Lower values keep them visible over a longer distance while the fog itself stays as
 * bright, which is not physically correct but is often preferable. Defaults to 1.
 * @property {number} anisotropy - The anisotropy of the scattering, 0-0.95 range. Larger values
 * scatter more light forward, making the fog brighter when looking towards the light. Defaults
 * to 0.6.
 * @property {number} intensity - The intensity of the light scattering. Defaults to 1.
 * @property {Color} ambientColor - The color of the ambient in-scattered light, which keeps the
 * fog in shadowed areas visible. Defaults to white.
 * @property {number} ambientIntensity - The intensity of the ambient in-scattered light. Defaults
 * to 0.02.
 * @property {number} maxDistance - The maximum world space distance the fog is raymarched to.
 * Defaults to 300.
 * @property {number} steps - The number of raymarching steps, 4-128 range. Higher values improve
 * the quality at a higher performance cost. Defaults to 24.
 * @property {number} scale - The resolution scale of the fog texture relative to the scene
 * render target, 0.25-1 range. Defaults to 0.5.
 */

/**
 * Implementation of a simple to use camera rendering pass, which supports SSAO, Bloom and
 * other rendering effects.
 *
 * Overriding compose shader chunks:
 * The final compose pass registers its shader chunks in a way that does not override any chunks
 * that were already provided. To customize the compose pass output, set your shader chunks on the
 * {@link ShaderChunks} map before creating the `CameraFrame`. Those chunks will be picked up by
 * the compose pass and preserved.
 *
 * Example (GLSL):
 *
 * @example
 * // Provide custom compose chunk(s) before constructing CameraFrame
 * ShaderChunks.get(graphicsDevice, SHADERLANGUAGE_GLSL).set('composeVignettePS', `
 *     vec3 applyVignette(vec3 color, vec2 uv) {
 *         return color * uv.x;
 *     }
 * `);
 *
 * // For WebGPU, use SHADERLANGUAGE_WGSL instead.
 *
 * @category Graphics
 */
class CameraFrame {
    /** @private */
    _enabled = true;

    /**
     * Rendering settings.
     *
     * @type {Rendering}
     */
    rendering = {
        renderFormats: [PIXELFORMAT_111110F, PIXELFORMAT_RGBA16F, PIXELFORMAT_RGBA32F],
        stencil: false,
        renderTargetScale: 1.0,
        samples: 1,
        sceneColorMap: false,
        sceneDepthMap: false,
        toneMapping: 0,
        sharpness: 0.0
    };

    /**
     * SSAO settings.
     *
     * @type {Ssao}
     */
    ssao = {
        type: SSAOTYPE_NONE,
        blurEnabled: true,
        randomize: false,
        intensity: 0.5,
        radius: 30,
        samples: 12,
        power: 6,
        minAngle: 10,
        scale: 1
    };

    /**
     * Bloom settings.
     *
     * @type {Bloom}
     */
    bloom = {
        intensity: 0,
        blurLevel: 16,
        threshold: 0
    };

    /**
     * The color grading effect, registered with this camera frame. Its parameters are assigned
     * directly.
     *
     * @type {GradingEffect}
     */
    grading;

    /**
     * The color lookup table (LUT) effect, registered with this camera frame. Its parameters are
     * assigned directly.
     *
     * @type {ColorLutEffect}
     */
    colorLUT;

    /**
     * The vignette effect, registered with this camera frame. Its parameters are assigned
     * directly.
     *
     * @type {VignetteEffect}
     */
    vignette;

    /**
     * The effects registered with this camera frame, in the order they are applied within their
     * compose slot. The built-in effects are registered by the constructor; add your own with
     * {@link CameraFrame#addEffect}. Treat the array as read-only; use the methods of the camera
     * frame to change it.
     *
     * @type {CameraFrameEffect[]}
     */
    effects = [];

    /**
     * The built-in effects this camera frame constructed, and so destroys.
     *
     * @type {CameraFrameEffect[]}
     * @private
     */
    _builtInEffects = [];

    /**
     * The effects taking part in the frames, in registration order: the active ones, as of the
     * last time the effects were applied - by {@link CameraFrame#update}, or by a change to the
     * registered effects.
     *
     * @type {CameraFrameEffect[]}
     * @ignore
     */
    _activeEffects = [];

    /**
     * The sharpening effect, whose sharpness is exposed as `rendering.sharpness`.
     *
     * @type {CasEffect}
     * @private
     */
    _cas;

    /**
     * Taa settings.
     *
     * @type {Taa}
     */
    taa = {
        enabled: false,
        jitter: 1
    };

    /**
     * The fringing effect, registered with this camera frame. Its parameters are assigned
     * directly.
     *
     * @type {FringingEffect}
     */
    fringing;

    /**
     * The color enhancement effect, registered with this camera frame. Its parameters are
     * assigned directly.
     *
     * @type {ColorEnhanceEffect}
     */
    colorEnhance;

    /**
     * DoF settings.
     *
     * @type {Dof}
     */
    dof = {
        enabled: false,
        nearBlur: false,
        focusDistance: 100,
        focusRange: 10,
        blurRadius: 3,
        blurRings: 4,
        blurRingPoints: 5,
        highQuality: true
    };

    /**
     * Volumetric fog settings.
     *
     * @type {VolumetricFog}
     */
    volumetricFog = {
        enabled: false,
        light: null,
        localOmniLights: false,
        localSpotLights: false,
        localIntensity: 1,
        localSteps: 12,
        tint: new Color(1, 1, 1),
        density: 0.01,
        heightBase: 0,
        heightFalloff: 0.05,
        extinction: 1,
        anisotropy: 0.6,
        intensity: 1,
        ambientColor: new Color(1, 1, 1),
        ambientIntensity: 0.02,
        maxDistance: 300,
        steps: 24,
        scale: 0.5
    };

    /**
     * Debug rendering, which displays an intermediate value of the frame in place of the composed
     * result. This never changes what the frame renders - a mode whose value this frame does not
     * generate simply displays nothing: 'depth' renders black when no effect has produced the scene
     * depth, and the modes of a disabled effect are ignored. Set to null to disable.
     *
     * Besides the built-in modes, this accepts the name of a debug view provided by an effect
     * registered with this camera frame, see {@link CameraFrameEffect#debugViews}.
     *
     * @type {null|'scene'|'ssao'|'bloom'|'vignette'|'dofcoc'|'dofblur'|'depth'|(string & {})}
     */
    debug = null;

    options = new CameraFrameOptions();

    /**
     * @type {FramePassCameraFrame|null}
     * @private
     */
    renderPassCamera = null;

    /**
     * Creates a new CameraFrame instance.
     *
     * @param {AppBase} app - The application.
     * @param {CameraComponent} cameraComponent - The camera component.
     */
    constructor(app, cameraComponent) {
        this.app = app;
        this.cameraComponent = cameraComponent;
        Debug.assert(cameraComponent, 'CameraFrame: cameraComponent must be defined');

        // the built-in effects, registered in the order they are applied within their slot. The
        // camera frame constructs them and so destroys them, unlike the effects added to it.
        const device = app.graphicsDevice;
        this._cas = new CasEffect(device);
        this.fringing = new FringingEffect(device);
        this.colorEnhance = new ColorEnhanceEffect(device);
        this.grading = new GradingEffect(device);
        this.colorLUT = new ColorLutEffect(device);
        this.vignette = new VignetteEffect(device);
        this._builtInEffects = [this._cas, this.fringing, this.colorEnhance, this.grading, this.colorLUT, this.vignette];
        this._builtInEffects.forEach(effect => this.addEffect(effect));

        // rendering.sharpness is the sharpening effect's parameter, forwarded to it so that the
        // effect is its single home
        const cas = this._cas;
        Object.defineProperty(this.rendering, 'sharpness', {
            get: () => cas.sharpness,
            set: (value) => {
                cas.sharpness = value;
            },
            enumerable: true
        });

        this.updateOptions();
        this.enable();

        // handle layer changes on the camera - render passes need to be update to reflect the changes
        this.cameraLayersChanged = cameraComponent.on('set:layers', () => {
            if (this.renderPassCamera) this.renderPassCamera.layersDirty = true;
        });
    }

    /**
     * Destroys the camera frame, removing all render passes.
     */
    destroy() {
        this.disable();

        // the built-in effects are ours to destroy; effects added by the user are theirs, and are
        // only detached
        this._builtInEffects.forEach(effect => effect.destroy());
        this.effects.forEach(effect => effect._detach());
        this.effects.length = 0;

        this.cameraLayersChanged.off();
    }

    /**
     * The graphics device.
     *
     * @type {GraphicsDevice}
     * @ignore
     */
    get device() {
        return this.app.graphicsDevice;
    }

    /**
     * The format of the render target the scene is rendered to, or undefined before the frame
     * passes exist. {@link PIXELFORMAT_RGBA8} when no HDR format is available.
     *
     * @type {number|undefined}
     * @ignore
     */
    get hdrFormat() {
        return this.renderPassCamera?.hdrFormat;
    }

    /**
     * Registers an effect with this camera frame. The effect is applied at the compose slot it
     * declares, after any effect already registered to that slot. The effect stays owned by the
     * caller: removing it or destroying the camera frame does not destroy it.
     *
     * @param {CameraFrameEffect} effect - The effect to add.
     * @example
     * const tint = new TintEffect(app.graphicsDevice);
     * cameraFrame.addEffect(tint);
     */
    addEffect(effect) {
        this.insertEffect(effect, this.effects.length);
    }

    /**
     * Registers an effect with this camera frame, applying it before another registered effect
     * when both share a compose slot.
     *
     * @param {CameraFrameEffect} effect - The effect to add.
     * @param {CameraFrameEffect|string} before - The effect, or the id of the effect, to apply
     * this one before.
     * @example
     * // apply the tint before the built-in vignette, which also runs at COMPOSESLOT_LDR
     * cameraFrame.insertEffectBefore(tint, 'vignette');
     */
    insertEffectBefore(effect, before) {
        const index = this.effects.findIndex(other => other === before || other.id === before);
        Debug.assert(index >= 0, `CameraFrame#insertEffectBefore: no effect '${before?.id ?? before}' is registered.`);
        this.insertEffect(effect, index >= 0 ? index : this.effects.length);
    }

    /**
     * Registers an effect at the given position of the effect list.
     *
     * @param {CameraFrameEffect} effect - The effect to add.
     * @param {number} index - The position.
     * @private
     */
    insertEffect(effect, index) {
        Debug.assert(effect, 'CameraFrame#addEffect: effect must be defined');
        Debug.assert(effect.device === this.device, `CameraFrame#addEffect: effect '${effect?.id}' was created on a different graphics device.`);
        Debug.assert(!this.effects.includes(effect), `CameraFrame#addEffect: effect '${effect.id}' is already registered.`);

        // effects and their debug views are looked up by name, so both must be unique among the
        // registered effects. The common way to trip this is adding a subclass of a built-in
        // effect alongside the built-in without giving the subclass its own id.
        Debug.call(() => {
            const sameId = this.effects.find(other => other.id === effect.id);
            Debug.assert(!sameId, `CameraFrame#addEffect: an effect with id '${effect.id}' is already registered. ` +
                'When adding a subclass of a built-in effect alongside it, give the subclass its own id.');

            for (const view of effect.debugViews) {
                Debug.assert(!builtinDebugViews.includes(view),
                    `CameraFrame#addEffect: debug view '${view}' of effect '${effect.id}' shadows a built-in debug view.`);

                const owner = this.effects.find(other => other.debugViews.includes(view));
                Debug.assert(!owner, `CameraFrame#addEffect: debug view '${view}' of effect '${effect.id}' ` +
                    `is already provided by effect '${owner?.id}'.`);
            }
        });

        this.effects.splice(index, 0, effect);
        effect._attach(this);
        this._applyEffects();
    }

    /**
     * Removes an effect from this camera frame.
     *
     * @param {CameraFrameEffect} effect - The effect to remove.
     */
    removeEffect(effect) {
        const index = this.effects.indexOf(effect);
        if (index >= 0) {
            this.effects.splice(index, 1);
            effect._detach();
            this._applyEffects();
        }
    }

    /**
     * Returns the registered effect with the given id, or undefined when no effect of that type is
     * registered.
     *
     * @param {string} id - The id the effect was constructed with, for example `'vignette'`.
     * @returns {CameraFrameEffect|undefined} The effect.
     */
    getEffect(id) {
        return this.effects.find(effect => effect.id === id);
    }

    /**
     * Applies the effects: decides which take part in the frames rendered until they are next
     * applied, has each of them apply its parameters, and hands them to the composition, which
     * rebuilds its shader only when they or their defines changed. Called by
     * {@link CameraFrame#update}, when the camera frame is enabled, and when an effect is added or
     * removed.
     *
     * @private
     */
    _applyEffects() {

        // the effects taking part until the effects are next applied, each applying its parameters
        const active = this._activeEffects;
        active.length = 0;
        const { effects } = this;
        for (let i = 0; i < effects.length; i++) {
            const effect = effects[i];
            if (effect.active) {
                active.push(effect);
                effect.update();
            }
        }

        const composePass = this.renderPassCamera?.composePass;
        if (composePass) {
            composePass.effects = active;
        }
    }

    enable() {
        this.renderPassCamera = this.createRenderPass();
        this.cameraComponent.framePasses = [this.renderPassCamera];
        this._applyEffects();
    }

    disable() {
        const cameraComponent = this.cameraComponent;
        cameraComponent.framePasses?.forEach((renderPass) => {
            renderPass.destroy();
        });
        cameraComponent.framePasses = [];
        cameraComponent.rendering = null;

        cameraComponent.jitter = 0;

        // disable SSAO included in the lighting pass
        cameraComponent.shaderParams.ssaoEnabled = false;

        this.renderPassCamera = null;
    }

    /**
     * Creates a frame pass for the camera frame. Override this method to utilize a custom frame
     * pass, typically one that extends `FramePassCameraFrame`.
     *
     * @returns {FramePassCameraFrame} - The frame pass.
     */
    createRenderPass() {
        return new FramePassCameraFrame(this.app, this, this.cameraComponent, this.options);
    }

    /**
     * Sets the enabled state of the camera frame. Passing false will release associated resources.
     *
     * @type {boolean}
     */
    set enabled(value) {
        if (this._enabled !== value) {
            if (value) {
                this.enable();
            } else {
                this.disable();
            }
            this._enabled = value;
        }
    }

    /**
     * Gets the enabled state of the camera frame.
     *
     * @type {boolean}
     */
    get enabled() {
        return this._enabled;
    }

    updateOptions() {

        const { options, rendering, bloom, taa, ssao } = this;
        options.stencil = rendering.stencil;
        options.samples = rendering.samples;
        options.sceneColorMap = rendering.sceneColorMap;
        options.prepassEnabled = rendering.sceneDepthMap;
        options.bloomEnabled = bloom.intensity > 0;
        options.taaEnabled = taa.enabled;
        options.ssaoType = ssao.type;
        options.ssaoBlurEnabled = ssao.blurEnabled;
        options.formats = rendering.renderFormats.slice();
        options.dofEnabled = this.dof.enabled;
        options.dofNearBlur = this.dof.nearBlur;
        options.dofHighQuality = this.dof.highQuality;
        options.volumetricFogEnabled = this._volumetricFogSupported();
    }

    /**
     * Returns true if the volumetric fog is enabled and its requirements are met - a perspective
     * camera, and a light source, which is either a directional light or the local lights.
     *
     * @returns {boolean} - True if the volumetric fog should render.
     * @private
     */
    _volumetricFogSupported() {
        const { volumetricFog, cameraComponent } = this;
        if (!volumetricFog.enabled) {
            return false;
        }
        if (volumetricFog.light && volumetricFog.light.type !== 'directional') {
            Debug.warnOnce('CameraFrame.volumetricFog.light needs to be a directional light, the effect is disabled.');
            return false;
        }
        let localLights = volumetricFog.localOmniLights || volumetricFog.localSpotLights;
        if (localLights && !cameraComponent.system.app.scene.clusteredLightingEnabled) {
            Debug.warnOnce('CameraFrame.volumetricFog local lights require clustered lighting to be enabled, the local lights are ignored.');
            localLights = false;
        }
        if (!volumetricFog.light && !localLights) {
            return false;
        }
        if (cameraComponent.projection !== PROJECTION_PERSPECTIVE) {
            Debug.warnOnce('CameraFrame.volumetricFog is only supported on perspective cameras, the effect is disabled.');
            return false;
        }
        return true;
    }

    /**
     * Returns whether a device is able to let the gaussian splats contribute to the scene depth, which
     * the volumetric fog and the depth of field need in order to be bounded by the splats instead of
     * drawing through them. Their contribution additionally has to be turned on using
     * {@link GSplatParams#sceneDepthWrite}; this reports whether doing so can take effect, so that an
     * application rendering gaussian splats can disable those effects on the devices which cannot
     * respect them.
     *
     * This tests the device alone, and so can be called before any camera frame is created. Whether a
     * particular one then renders the depth this way also depends on its own settings - multi-sampling
     * and a camera not clearing the whole of its render target both rule it out - and a debug build
     * warns, naming the reason, when the splats end up not contributing.
     *
     * @param {GraphicsDevice} device - The graphics device.
     * @returns {boolean} True if the splats can contribute to the scene depth.
     */
    static isSplatSceneDepthSupported(device) {
        return FramePassCameraFrame.isSceneTextureDepthSupported(device);
    }

    /**
     * Applies any changes made to the properties of this instance.
     */
    update() {

        if (!this._enabled) return;

        const cameraComponent = this.cameraComponent;
        const { options, renderPassCamera, rendering, bloom, taa, ssao } = this;

        // options that can cause the passes to be re-created
        this.updateOptions();
        renderPassCamera.update(options);

        // update parameters of individual render passes
        const { composePass, bloomPass, ssaoPass, dofPass, volumetricFogPass } = renderPassCamera;

        renderPassCamera.renderTargetScale = math.clamp(rendering.renderTargetScale, 0.1, 1);
        composePass.toneMapping = rendering.toneMapping;

        if (options.bloomEnabled && bloomPass) {
            composePass.bloomIntensity = bloom.intensity;
            bloomPass.blurLevel = bloom.blurLevel;
            bloomPass.threshold = bloom.threshold;
        }

        if (options.dofEnabled) {
            dofPass.focusDistance = this.dof.focusDistance;
            dofPass.focusRange = this.dof.focusRange;
            dofPass.blurRadius = this.dof.blurRadius;
            dofPass.blurRings = this.dof.blurRings;
            dofPass.blurRingPoints = this.dof.blurRingPoints;
        }

        if (options.volumetricFogEnabled) {
            const { volumetricFog } = this;
            volumetricFogPass.light = volumetricFog.light?.light ?? null;
            volumetricFogPass.localOmniLights = volumetricFog.localOmniLights;
            volumetricFogPass.localSpotLights = volumetricFog.localSpotLights;
            volumetricFogPass.localIntensity = volumetricFog.localIntensity;
            volumetricFogPass.localSteps = math.clamp(volumetricFog.localSteps, 2, 64);
            volumetricFogPass.tint.copy(volumetricFog.tint);
            volumetricFogPass.density = volumetricFog.density;
            volumetricFogPass.heightBase = volumetricFog.heightBase;
            volumetricFogPass.heightFalloff = volumetricFog.heightFalloff;
            volumetricFogPass.extinction = Math.max(volumetricFog.extinction, 0);
            volumetricFogPass.anisotropy = math.clamp(volumetricFog.anisotropy, 0, 0.95);
            volumetricFogPass.intensity = volumetricFog.intensity;
            volumetricFogPass.ambientColor.copy(volumetricFog.ambientColor);
            volumetricFogPass.ambientIntensity = volumetricFog.ambientIntensity;
            volumetricFogPass.maxDistance = volumetricFog.maxDistance;
            volumetricFogPass.steps = math.clamp(volumetricFog.steps, 4, 128);
            volumetricFogPass.scale = math.clamp(volumetricFog.scale, 0.25, 1);
        }

        if (options.ssaoType !== SSAOTYPE_NONE) {
            ssaoPass.intensity = ssao.intensity;
            ssaoPass.power = ssao.power;
            ssaoPass.radius = ssao.radius;
            ssaoPass.sampleCount = ssao.samples;
            ssaoPass.minAngle = ssao.minAngle;
            ssaoPass.scale = ssao.scale;
            ssaoPass.randomize = ssao.randomize;
        }

        // enable camera jitter if taa is enabled
        cameraComponent.jitter = taa.enabled ? taa.jitter : 0;

        // the effects apply their parameters, and the frames rendered from now use them
        this._applyEffects();

        // debug rendering
        composePass.debug = this.debug;
        if (composePass.debug === 'ssao' && options.ssaoType === SSAOTYPE_NONE) composePass.debug = null;

        // a debug view owned by an effect is only available while that effect is active
        const debugOwner = this.effects.find(effect => effect.debugViews.includes(composePass.debug));
        if (debugOwner && !debugOwner.active) composePass.debug = null;
    }
}

export { CameraFrame };
