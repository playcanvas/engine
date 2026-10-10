import { Debug } from '../../core/debug.js';
import { math } from '../../core/math/math.js';
import { PIXELFORMAT_111110F, PIXELFORMAT_RGBA16F, PIXELFORMAT_RGBA32F, PIXELFORMAT_RGBA8 } from '../../platform/graphics/constants.js';
import { FRAMERESOURCE_DEPTH, FRAMERESOURCE_PREPASSDEPTH } from './constants.js';
import { BloomEffect } from './effects/bloom-effect.js';
import { CasEffect } from './effects/cas-effect.js';
import { ColorEnhanceEffect } from './effects/color-enhance-effect.js';
import { ColorLutEffect } from './effects/color-lut-effect.js';
import { DofEffect } from './effects/dof-effect.js';
import { FringingEffect } from './effects/fringing-effect.js';
import { GradingEffect } from './effects/grading-effect.js';
import { SsaoEffect } from './effects/ssao-effect.js';
import { VignetteEffect } from './effects/vignette-effect.js';
import { VolumetricFogEffect } from './effects/volumetric-fog-effect.js';
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
const builtinDebugViews = ['scene', 'depth', 'depthmissing'];

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
 * anti-aliasing. Typically set to 1 when post-process anti-aliasing such as TAA or SMAA is used,
 * although these techniques can be combined with MSAA at a higher cost. Defaults to 1.
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
 * @typedef {Object} Smaa
 * Properties related to Subpixel Morphological Anti-Aliasing (SMAA), a spatial post-processing
 * technique that smooths geometric edges without using frame history.
 * @property {boolean} enabled - Whether SMAA 1x is enabled. Defaults to false.
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
     * The screen space ambient occlusion effect, registered with this camera frame. Its parameters
     * are assigned directly.
     *
     * @type {SsaoEffect}
     */
    ssao;

    /**
     * The bloom effect, registered with this camera frame. Its parameters are assigned directly.
     *
     * @type {BloomEffect}
     */
    bloom;

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
     * The scene format, see {@link CameraFrame#hdrFormat}.
     *
     * @type {number}
     * @private
     */
    _hdrFormat = PIXELFORMAT_RGBA8;

    /**
     * The effects taking part in the frames, in registration order: the active ones, as of the
     * last time the effects were applied by {@link CameraFrame#update}, or when the camera frame
     * was enabled.
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
     * SMAA settings.
     *
     * @type {Smaa}
     */
    smaa = {
        enabled: false
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
     * The depth of field effect, registered with this camera frame. Its parameters are assigned
     * directly.
     *
     * @type {DofEffect}
     */
    dof;

    /**
     * The volumetric fog effect, registered with this camera frame. Its parameters are assigned
     * directly.
     *
     * @type {VolumetricFogEffect}
     */
    volumetricFog;

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
     * @ignore
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
        this.dof = new DofEffect(device);
        this.ssao = new SsaoEffect(device);
        this.volumetricFog = new VolumetricFogEffect(device);
        this.bloom = new BloomEffect(device);
        this.colorEnhance = new ColorEnhanceEffect(device);
        this.grading = new GradingEffect(device);
        this.colorLUT = new ColorLutEffect(device);
        this.vignette = new VignetteEffect(device);
        this._builtInEffects = [this._cas, this.fringing, this.dof, this.ssao, this.volumetricFog, this.bloom, this.colorEnhance, this.grading, this.colorLUT, this.vignette];
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

        // the built-in effects are ours to destroy, which releases their passes and unregisters
        // them; effects added by the user are theirs - the frame passes release the passes of those
        // still registered, and they are then only detached
        this._builtInEffects.forEach(effect => effect.destroy());
        this.disable();
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
     * The format of the render target the scene is rendered to: the first of the preferred render
     * formats the device can render to, or {@link PIXELFORMAT_RGBA8} when none of them is
     * available. Chosen by {@link CameraFrame#update}, before the frame passes are built, so that
     * the effects can depend on it.
     *
     * @type {number}
     * @ignore
     */
    get hdrFormat() {
        return this._hdrFormat;
    }

    /**
     * Registers an effect with this camera frame. The effect is applied at the compose slot it
     * declares, after any effect already registered to that slot, from the next call to
     * {@link CameraFrame#update}. The effect stays owned by the caller: removing it or destroying
     * the camera frame does not destroy it.
     *
     * @param {CameraFrameEffect} effect - The effect to add.
     * @example
     * const tint = new TintEffect(app.graphicsDevice);
     * cameraFrame.addEffect(tint);
     * cameraFrame.update();
     */
    addEffect(effect) {
        this.insertEffect(effect, this.effects.length);
    }

    /**
     * Registers an effect with this camera frame, applying it before another registered effect
     * when both share a compose slot. The effect is applied from the next call to
     * {@link CameraFrame#update}.
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
    }

    /**
     * Removes an effect from this camera frame. The effect stops being applied from the next call
     * to {@link CameraFrame#update}.
     *
     * @param {CameraFrameEffect} effect - The effect to remove.
     * @example
     * cameraFrame.removeEffect(tint);
     * cameraFrame.update();
     */
    removeEffect(effect) {
        const index = this.effects.indexOf(effect);
        if (index >= 0) {
            this.effects.splice(index, 1);
            effect._detach();
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
     * {@link CameraFrame#update} and when the camera frame is enabled, after the frame passes are
     * built.
     *
     * @private
     */
    _applyEffects() {

        // the effects taking part until the effects are next applied, each applying its parameters:
        // the active ones, of which those owning passes only once the frame passes include theirs
        const active = this._activeEffects;
        active.length = 0;
        const { effects, renderPassCamera } = this;
        for (let i = 0; i < effects.length; i++) {
            const effect = effects[i];
            if (effect.active && (!effect._ownsPasses || renderPassCamera?.hasEffectPasses(effect))) {
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

        // the passes are built from the current settings, as CameraFrame#update builds them - the
        // settings can have changed while the camera frame was disabled, which update ignores
        this.updateOptions();
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

        const { options, rendering, taa, smaa } = this;
        options.stencil = rendering.stencil;
        options.samples = rendering.samples;
        options.sceneColorMap = rendering.sceneColorMap;
        options.prepassEnabled = rendering.sceneDepthMap;
        options.taaEnabled = taa.enabled;
        options.smaaEnabled = smaa.enabled;
        options.formats = rendering.renderFormats.slice();

        // the scene format, chosen before the effects are asked whether they are active, as an
        // effect can depend on an HDR scene
        this._hdrFormat = this.device.getRenderableHdrFormat(options.formats, true, options.samples) || PIXELFORMAT_RGBA8;

        // the active registered effects owning passes, the resources they require and what else
        // their passes depend on - the frame passes are rebuilt when this changes. The effects are
        // identified by instance, so that replacing one with a new instance of the same id builds
        // the passes of the new one. The scene depth is rendered for any active effect requiring
        // it, those without passes included.
        let effectPasses = '';
        let depthRequired = false;
        let prepassDepthRequired = false;
        const { effects } = this;
        for (let i = 0; i < effects.length; i++) {
            const effect = effects[i];
            if (effect.active) {
                const { requires } = effect;
                depthRequired ||= requires.includes(FRAMERESOURCE_DEPTH);
                prepassDepthRequired ||= requires.includes(FRAMERESOURCE_PREPASSDEPTH);
                if (effect._ownsPasses) {
                    effectPasses += `${effect._uid}:${requires}:${effect.buildKey()};`;
                }
            }
        }
        options.effectPasses = effectPasses;
        options.depthRequired = depthRequired;
        options.prepassDepthRequired = prepassDepthRequired;
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
        const { options, renderPassCamera, rendering, taa } = this;

        // options that can cause the passes to be re-created
        this.updateOptions();
        renderPassCamera.update(options);

        // update parameters of individual render passes
        const { composePass } = renderPassCamera;

        renderPassCamera.renderTargetScale = math.clamp(rendering.renderTargetScale, 0.1, 1);
        composePass.toneMapping = rendering.toneMapping;

        // enable camera jitter if taa is enabled
        cameraComponent.jitter = taa.enabled ? taa.jitter : 0;

        // the effects apply their parameters, and the frames rendered from now use them
        this._applyEffects();

        // debug rendering
        composePass.debug = this.debug;

        // a debug view owned by an effect is only available while that effect takes part
        const debugOwner = this.effects.find(effect => effect.debugViews.includes(composePass.debug));
        if (debugOwner && !this._activeEffects.includes(debugOwner)) composePass.debug = null;
    }
}

export { CameraFrame };
