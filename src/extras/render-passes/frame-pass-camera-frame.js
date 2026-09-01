import { LAYERID_SKYBOX, LAYERID_IMMEDIATE, TONEMAP_NONE, GAMMA_NONE, SCENETEXTURE_DEPTH } from '../../scene/constants.js';
import { ADDRESS_CLAMP_TO_EDGE, FILTER_LINEAR, PIXELFORMAT_R16F, PIXELFORMAT_R32F, PIXELFORMAT_RGBA8 } from '../../platform/graphics/constants.js';
import { Texture } from '../../platform/graphics/texture.js';
import { FramePass } from '../../platform/graphics/frame-pass.js';
import { FramePassColorGrab } from '../../scene/graphics/frame-pass-color-grab.js';
import { RenderPassForward } from '../../scene/renderer/render-pass-forward.js';
import { RenderTarget } from '../../platform/graphics/render-target.js';

import { FramePassBloom } from './frame-pass-bloom.js';
import { RenderPassCompose } from './render-pass-compose.js';
import { RenderPassTAA } from './render-pass-taa.js';
import { FramePassDof } from './frame-pass-dof.js';
import { FramePassVolumetricFog } from './frame-pass-volumetric-fog.js';
import { RenderPassPrepass } from './render-pass-prepass.js';
import { RenderPassSsao } from './render-pass-ssao.js';
import { SSAOTYPE_COMBINE, SSAOTYPE_LIGHTING, SSAOTYPE_NONE } from './constants.js';
import { Debug } from '../../core/debug.js';
import { RenderPassDownsample } from './render-pass-downsample.js';
import { Color } from '../../core/math/color.js';

/**
 * @import { CameraFrame } from './camera-frame.js'
 * @import { GraphicsDevice } from '../../platform/graphics/graphics-device.js'
 */

/**
 * Options used to configure the FramePassCameraFrame. To modify these options, you must create
 * a new instance of the FramePassCameraFrame with the desired settings.
 *
 * @ignore
 */
class CameraFrameOptions {
    formats;

    stencil = false;

    samples = 1;

    sceneColorMap = false;

    // skybox is the last layer rendered before the grab passes
    lastGrabLayerId = LAYERID_SKYBOX;

    lastGrabLayerIsTransparent = false;

    // immediate layer is the last layer rendered before the post-processing
    lastSceneLayerId = LAYERID_IMMEDIATE;

    lastSceneLayerIsTransparent = true;

    // TAA
    taaEnabled = false;

    // Bloom
    bloomEnabled = false;

    // SSAO
    ssaoType = SSAOTYPE_NONE;

    ssaoBlurEnabled = true;

    prepassEnabled = false;

    // Whether the scene depth is rendered by the scene pass into an additional attachment of the
    // scene render target, instead of, or in addition to, by the depth prepass. This is not a user
    // setting - sanitizeOptions derives it from what needs the depth and what the device supports.
    sceneTextureDepth = false;

    // DOF
    dofEnabled = false;

    dofNearBlur = false;

    dofHighQuality = true;

    // Volumetric fog
    volumetricFogEnabled = false;
}

const _defaultOptions = new CameraFrameOptions();

// the formats the scene depth can be rendered to, in the order of preference
const _sceneDepthFormats = [PIXELFORMAT_R32F, PIXELFORMAT_R16F];

// the smallest half float which is still normal, and so the smallest one whose precision is relative to
// its own magnitude. Below it the format is subnormal, where precision falls away in absolute terms
const _minHalfFloatNormal = 6.103515625e-5;

/**
 * Render pass implementation of a common camera frame rendering with integrated post-processing
 * effects.
 *
 * @category Graphics
 * @ignore
 */
class FramePassCameraFrame extends FramePass {
    app;

    prePass;

    scenePass;

    composePass;

    bloomPass;

    ssaoPass;

    taaPass;

    scenePassHalf;

    dofPass;

    volumetricFogPass;

    _renderTargetScale = 1;

    /**
     * True if the render pass needs to be re-created because layers have been added or removed.
     *
     * @ignore
     */
    layersDirty = false;

    /**
     * The camera frame that this render pass belongs to.
     *
     * @type {CameraFrame}
     */
    cameraFrame;

    /**
     * @type {RenderTarget|null}
     * @private
     */
    rt = null;

    /**
     * The names of the scene textures the scene pass renders alongside the scene color, in the order
     * of the color attachments they are rendered to. The scene passes are given this array itself, so
     * that assigning it to the camera as they render does not allocate.
     *
     * @type {string[]}
     * @private
     */
    _sceneTextureNames = [];

    /**
     * The scene depth rendered by the scene pass as a scene texture, or null when the depth is not
     * rendered this way. Owned by the scene render target it is attached to.
     *
     * @type {Texture|null}
     * @private
     */
    sceneDepthTexture = null;

    /**
     * The color attachment index the scene depth is rendered to, or 0 when it is not rendered.
     *
     * @type {number}
     * @private
     */
    sceneDepthSlot = 0;

    /**
     * A render target holding the scene color alone, aliasing the color attachment of the scene
     * render target. The passes blending into the scene after it has been rendered use this instead of
     * the scene render target, as they sample the scene textures, and a texture attached to the render
     * target being rendered into cannot be sampled. Null when there are no scene textures.
     *
     * @type {RenderTarget|null}
     * @private
     */
    rtSceneColor = null;

    /**
     * The clear value of the scene depth texture, set up each frame as it depends on the camera's far
     * clip. The alpha is 1, so that what the gaussian splats blend into it stays a weighted average.
     *
     * @type {Color}
     * @private
     */
    _sceneDepthClearValue = new Color(0, 0, 0, 1);

    constructor(app, cameraFrame, cameraComponent, options = {}) {
        Debug.assert(app);
        super(app.graphicsDevice);
        this.app = app;
        this.cameraComponent = cameraComponent;
        this.cameraFrame = cameraFrame;

        this.options = this.sanitizeOptions(options);
        this.setupRenderPasses(this.options);
    }

    destroy() {
        this.reset();
    }

    reset() {

        this.sceneTexture = null;
        this.sceneTextureHalf = null;

        if (this.sceneDepthTexture) {

            // the texture itself is owned by the scene render target, destroyed below
            this.sceneDepthTexture = null;
            this.sceneDepthSlot = 0;
            this._sceneTextureNames.length = 0;

            const { shaderParams } = this.cameraComponent;
            shaderParams.sceneDepthMapLinear = false;
            shaderParams.sceneDepthMapPacked = false;
            shaderParams.sceneDepthMapReciprocal = false;
        }

        if (this.rtSceneColor) {

            // only aliases the scene color texture, which the scene render target owns
            this.rtSceneColor.destroy();
            this.rtSceneColor = null;
        }

        if (this.rt) {
            this.rt.destroyTextureBuffers();
            this.rt.destroy();
            this.rt = null;
        }

        if (this.rtHalf) {
            this.rtHalf.destroyTextureBuffers();
            this.rtHalf.destroy();
            this.rtHalf = null;
        }

        // destroy all passes we created
        this.beforePasses.forEach(pass => pass.destroy());
        this.beforePasses.length = 0;

        this.prePass = null;
        this.scenePass = null;
        this.scenePassTransparent = null;
        this.colorGrabPass = null;
        this.composePass = null;
        this.bloomPass = null;
        this.ssaoPass = null;
        this.taaPass = null;
        this.afterPass = null;
        this.scenePassHalf = null;
        this.dofPass = null;
        this.volumetricFogPass = null;
    }

    sanitizeOptions(options) {
        options = Object.assign({}, _defaultOptions, options);

        // depth consumed by the passes running after the scene pass. SSAO belongs here when the compose
        // pass is what applies it, as it is then free to run after the scene - see collectPasses.
        const postProcessDepth = options.taaEnabled || options.dofEnabled ||
            options.volumetricFogEnabled || options.ssaoType === SSAOTYPE_COMBINE;

        const inSceneDepth = this.needsInSceneDepth(options);
        const splatDepth = this.app.scene.gsplat.sceneDepthWrite;
        const deviceSupported = FramePassCameraFrame.isSceneTextureDepthSupported(this.device);
        const unsupportedReason = this.sceneTexturesUnsupportedReason(options);

        // The scene textures only exist once the scene pass has finished, so they can serve the
        // post-processing passes alone. When nothing needs the depth earlier they replace the prepass
        // outright, which is both cheaper - no additional geometry pass - and better, as the gaussian
        // splats contribute to them.
        //
        // Two configurations make them worth their bandwidth only if the splats do contribute, which is
        // what the scene setting asks for: when the prepass is rendered anyway, and when the depth would
        // be stored at half float precision - the prepass stores it more precisely, either as R32F or
        // losslessly packed, and the effects consuming it are sensitive to that.
        const requiresSplatDepth = inSceneDepth || this.sceneDepthFormat !== PIXELFORMAT_R32F;

        options.sceneTextureDepth = postProcessDepth && deviceSupported && !unsupportedReason &&
            (!requiresSplatDepth || splatDepth);

        options.prepassEnabled = inSceneDepth || (postProcessDepth && !options.sceneTextureDepth);

        Debug.call(() => {

            // the splats contribute only when the scene depth is rendered by the scene pass and they are
            // set to write it. Note that the first alone is not enough - the scene textures can be
            // rendered while the splats stay out of them.
            const splatsContribute = options.sceneTextureDepth && splatDepth;
            if (postProcessDepth && !splatsContribute && this.rendersGSplats()) {
                const reason = !deviceSupported ?
                    'this device cannot render the scene depth the splats contribute to - see CameraFrame.isSplatSceneDepthSupported' :
                    unsupportedReason ??
                    'Scene#gsplat.sceneDepthWrite is not set - setting it includes them, at the cost of an additional render target attachment';
                Debug.warnOnce(`CameraFrame: the gaussian splats this camera renders do not contribute to the scene depth, and so the effects using it (the volumetric fog and the depth of field) are not bound by them: ${reason}.`);
            }
        });

        return options;
    }

    /**
     * Whether the gaussian splat director has any splats for this camera. Reports this in a debug build
     * only, and returns false otherwise, as the only use of it is to advise on the scene setting - the
     * shape of the pipeline is a function of the settings alone, and never of the contents of the scene,
     * so that it does not change as the splats are loaded or culled.
     *
     * @returns {boolean} True if the camera renders gaussian splats.
     * @private
     */
    rendersGSplats() {
        let renders = false;
        Debug.call(() => {
            const director = this.app.renderer.gsplatDirector;
            const cameraData = director?.camerasMap.get(this.cameraComponent.camera);
            renders = (cameraData?.layersMap.size ?? 0) > 0;
        });
        return renders;
    }

    /**
     * Whether the depth is consumed no later than the scene pass - by the materials when the user asks
     * for the scene depth map, and by SSAO applied during shading, whose texture the lit shaders sample
     * and which therefore has to be generated before the scene renders. Only the prepass supplies that,
     * as the scene textures do not exist until the scene pass has finished.
     *
     * @param {CameraFrameOptions} options - The options.
     * @returns {boolean} True if the depth is needed no later than the scene pass.
     * @private
     */
    needsInSceneDepth(options) {
        return options.prepassEnabled || options.ssaoType === SSAOTYPE_LIGHTING;
    }

    /**
     * Why this camera cannot render the scene textures, on top of what
     * {@link FramePassCameraFrame.isSceneTextureDepthSupported} already rules out, or null when it can.
     * Note that this is not reported on its own - the scene textures are not something the user asks
     * for, so a camera which cannot use them simply renders the depth with the prepass instead. The
     * reason is only used to explain why the gaussian splats do not contribute to the scene depth,
     * which is visible in the result.
     *
     * @param {CameraFrameOptions} options - The options.
     * @returns {string|null} The reason, or null when this camera can render the scene textures.
     * @private
     */
    sceneTexturesUnsupportedReason(options) {

        // the depth is blended into by the gaussian splats, and resolving it from a multi-sampled
        // attachment would average the depths across a silhouette, giving a depth which unprojects to
        // empty space
        if (options.samples > 1) {
            return 'multi-sampling is enabled on the CameraFrame, which the scene depth cannot be rendered with';
        }

        // The depth is stored as its reciprocal, so what has to be representable is one over the far
        // clip rather than the far clip itself. A half float holds that to a few parts in ten thousand
        // while it stays normal, but below that it turns subnormal and the precision falls away
        // absolutely - far enough out that the reciprocal of the cleared far clip no longer decodes to
        // anything near it, and a pixel nothing covered stops being recognisable as empty.
        if (this.sceneDepthFormat === PIXELFORMAT_R16F &&
            1 / this.cameraComponent.camera.farClip < _minHalfFloatNormal) {
            const limit = Math.floor(1 / _minHalfFloatNormal);
            return `the far clip of this camera is too far for a half float scene depth - keep it below ${limit}, as the depth is stored as its reciprocal`;
        }

        // a camera which does not clear the whole render target, or which is not the first one
        // rendering to it, clears from inside the render pass, and that clear is not attachment aware
        // - it would also clear the scene textures
        if (!this.cameraComponent.camera.fullSizeClearRect) {
            return 'this camera does not clear the whole render target, and the clear it uses instead would also clear the scene depth';
        }

        // The depth prepass, which this camera needs as well, publishes its depth to the same uniform
        // as the scene textures do, and so the two have to store it the same way - the shaders sampling
        // it are generated once, from a single declaration of the encoding. Where a float texture cannot
        // be rendered to, the prepass falls back to packing the depth into RGBA8, which the scene
        // textures cannot do, as packed values cannot be blended into.
        //
        // This restriction could be lifted by giving the passes which consume the depth after the scene
        // pass a uniform of their own, separate from the one the prepass publishes to. Each would then
        // declare its own encoding and the two producers could coexist - and as the scene texture depth
        // is always linear and unpacked, a single define would describe it. That would also remove the
        // need to publish the scene textures from the last scene pass only, and to clear the uniform
        // when no prepass runs, as the materials would no longer be able to sample them at all. Note
        // that the choice of which uniform to sample would have to be made per consuming pass rather
        // than per camera, as SSAO applied during shading runs before the scene pass and so has to keep
        // reading the depth of the prepass.
        if (this.needsInSceneDepth(options) && !this.device.textureFloatRenderable) {
            return 'the depth prepass this camera also needs stores the depth packed into RGBA8 on this device, which the scene depth cannot be stored as';
        }

        return null;
    }

    /**
     * The format of the scene depth texture, or undefined when the device supports no floating point
     * format which can be both rendered and blended into.
     *
     * @type {number|undefined}
     * @private
     */
    get sceneDepthFormat() {
        return FramePassCameraFrame.getSceneDepthFormat(this.device);
    }

    /**
     * The format the scene depth is rendered to on the given device, or undefined when it supports no
     * suitable one. Static, so that the support for it can be tested before a camera frame exists.
     *
     * @param {GraphicsDevice} device - The graphics device.
     * @returns {number|undefined} The format, or undefined when there is none.
     * @ignore
     */
    static getSceneDepthFormat(device) {

        // full precision is preferred, as the depth is stored in linear view space units and half float
        // steps by a whole unit at a far clip of a thousand. Blending is required, as that is how the
        // gaussian splats accumulate their weighted average, and filtering is not - the depth is point
        // sampled.
        return device.getRenderableHdrFormat(_sceneDepthFormats, false, 1, true);
    }

    /**
     * Whether the given device can render the scene textures at all. A particular camera can still be
     * set up in a way which prevents it - see
     * {@link FramePassCameraFrame#sceneTexturesUnsupportedReason}.
     *
     * @param {GraphicsDevice} device - The graphics device.
     * @returns {boolean} True if the device can render the scene textures.
     * @ignore
     */
    static isSceneTextureDepthSupported(device) {

        // the materials which do not write the scene textures need the writes to their attachments
        // masked off individually, which is not expressible without independent blending - their draws
        // would be invalid
        return device.supportsIndependentBlending &&
            FramePassCameraFrame.getSceneDepthFormat(device) !== undefined;
    }

    set renderTargetScale(value) {
        this._renderTargetScale = value;
        if (this.scenePass) {
            this.scenePass.scaleX = value;
            this.scenePass.scaleY = value;
        }
    }

    get renderTargetScale() {
        return this._renderTargetScale;
    }

    needsReset(options) {
        const currentOptions = this.options;

        // helper to compare arrays
        const arraysNotEqual = (arr1, arr2) => arr1 !== arr2 &&
            (!(Array.isArray(arr1) && Array.isArray(arr2)) ||
            arr1.length !== arr2.length ||
            !arr1.every((value, index) => value === arr2[index]));

        return options.ssaoType !== currentOptions.ssaoType ||
            options.ssaoBlurEnabled !== currentOptions.ssaoBlurEnabled ||
            options.taaEnabled !== currentOptions.taaEnabled ||
            options.samples !== currentOptions.samples ||
            options.stencil !== currentOptions.stencil ||
            options.bloomEnabled !== currentOptions.bloomEnabled ||
            options.prepassEnabled !== currentOptions.prepassEnabled ||
            options.sceneTextureDepth !== currentOptions.sceneTextureDepth ||
            options.sceneColorMap !== currentOptions.sceneColorMap ||
            options.dofEnabled !== currentOptions.dofEnabled ||
            options.dofNearBlur !== currentOptions.dofNearBlur ||
            options.dofHighQuality !== currentOptions.dofHighQuality ||
            options.volumetricFogEnabled !== currentOptions.volumetricFogEnabled ||
            arraysNotEqual(options.formats, currentOptions.formats);
    }

    // manually called, applies changes
    update(options) {

        options = this.sanitizeOptions(options);

        // destroy existing passes if they need to be re-created
        if (this.needsReset(options) || this.layersDirty) {
            this.layersDirty = false;
            this.reset();
        }

        // need to shallow copy the options to the instance
        this.options = options;

        // build new passes
        if (!this.sceneTexture) {
            this.setupRenderPasses(this.options);
        }
    }

    createRenderTarget(name, depth, stencil, samples, sceneTextures) {

        const texture = new Texture(this.device, {
            name: name,
            width: 4,
            height: 4,
            format: this.hdrFormat,
            mipmaps: false,
            minFilter: FILTER_LINEAR,
            magFilter: FILTER_LINEAR,
            addressU: ADDRESS_CLAMP_TO_EDGE,
            addressV: ADDRESS_CLAMP_TO_EDGE
        });

        return new RenderTarget({
            colorBuffers: sceneTextures?.length ? [texture, ...sceneTextures] : [texture],
            depth: depth,
            stencil: stencil,
            samples: samples
        });
    }

    setupRenderPasses(options) {

        const { device } = this;
        const cameraComponent = this.cameraComponent;
        const targetRenderTarget = cameraComponent.renderTarget;

        this.hdrFormat = device.getRenderableHdrFormat(options.formats, true, options.samples) || PIXELFORMAT_RGBA8;

        // HDR bloom is not supported on RGBA8 format
        this._bloomEnabled = options.bloomEnabled && this.hdrFormat !== PIXELFORMAT_RGBA8;

        // bloom and DOF needs half resolution scene texture
        this._sceneHalfEnabled = this._bloomEnabled || options.dofEnabled;

        // set up internal rendering parameters - this affect the shader generation to apply SSAO during forward pass
        cameraComponent.shaderParams.ssaoEnabled = options.ssaoType === SSAOTYPE_LIGHTING;

        // The scene textures are rendered by the scene pass into the color attachments after the scene
        // color, each enabled one taking the next. This is the only place their layout is decided -
        // the names are handed to the scene passes, which give them to the shaders, and the slot each
        // one lands on follows from the order.
        const sceneTextures = [];
        const names = this._sceneTextureNames;
        names.length = 0;
        if (options.sceneTextureDepth) {
            this.sceneDepthTexture = Texture.createDataTexture2D(device, 'SceneTextureDepth', 4, 4, this.sceneDepthFormat);
            sceneTextures.push(this.sceneDepthTexture);
            names.push(SCENETEXTURE_DEPTH);
            this.sceneDepthSlot = sceneTextures.length;
        }

        // create a render target to render the scene into. This uses the API-native orientation
        // regardless of the orientation of the target render target - the compose pass flips its
        // sampling when needed to store the requested orientation in the target render target.
        this.rt = this.createRenderTarget('SceneColor', true, options.stencil, options.samples, sceneTextures);
        this.sceneTexture = this.rt.colorBuffer;

        if (this.sceneDepthTexture) {


            // declare how the depth is stored, for the shaders which sample it. Declared at setup,
            // because the post-processing passes resolve these defines when they are constructed.
            const { shaderParams } = cameraComponent;
            shaderParams.sceneDepthMapLinear = true;
            shaderParams.sceneDepthMapPacked = false;

            // the scene pass accumulates an average of the reciprocals, as the blended splats
            // contribute to it - unlike the prepass, which writes the depth outright
            shaderParams.sceneDepthMapReciprocal = true;

            // the passes blending into the scene color after the scene pass sample the scene depth, so
            // they cannot render to the render target it is attached to
            this.rtSceneColor = new RenderTarget({
                name: 'SceneColorOnly',
                colorBuffers: [this.sceneTexture],
                depth: false,
                samples: 1
            });
        }

        // when half size scene color buffer is used
        if (this._sceneHalfEnabled) {
            this.rtHalf = this.createRenderTarget('SceneColorHalf', false, false, 1);
            this.sceneTextureHalf = this.rtHalf.colorBuffer;
        }

        this.sceneOptions = {
            resizeSource: targetRenderTarget,
            scaleX: this.renderTargetScale,
            scaleY: this.renderTargetScale
        };

        this.createPasses(options);

        const allPasses = this.collectPasses();
        this.beforePasses = allPasses.filter(element => element !== undefined && element !== null);

        this.updateCameraUseFlags();
    }

    /**
     * Scan all RenderPassForward instances in the pass chain and mark the first / last
     * layer render step per camera with firstCameraUse / lastCameraUse. This mirrors what
     * LayerComposition does for the non-CameraFrame path and ensures that beforePasses
     * collection and EVENT_PRERENDER / EVENT_POSTRENDER fire exactly once per camera.
     *
     * @private
     */
    updateCameraUseFlags() {
        const firstSeen = new Map();
        const lastSeen = new Map();

        for (let i = 0; i < this.beforePasses.length; i++) {
            const pass = this.beforePasses[i];
            if (pass instanceof RenderPassForward) {
                const steps = pass.layerRenderSteps;
                for (let j = 0; j < steps.length; j++) {
                    const step = steps[j];
                    const cam = step.cameraComponent;
                    if (cam) {
                        if (!firstSeen.has(cam)) {
                            firstSeen.set(cam, step);
                        }
                        lastSeen.set(cam, step);
                    }
                }
            }
        }

        firstSeen.forEach((step) => {
            step.firstCameraUse = true;
        });
        lastSeen.forEach((step) => {
            step.lastCameraUse = true;
        });
    }

    collectPasses() {

        // SSAO applied during shading has to be generated before the scene pass, as the lit shaders
        // sample its texture as they render. Applied by the compose pass instead, it is free to run
        // after the scene, where the depth it needs can come from the scene textures - which include
        // the gaussian splats and require no prepass.
        const ssaoBeforeScene = this.options.ssaoType === SSAOTYPE_LIGHTING;

        // use these prepared render passes in the order they should be executed
        return [
            this.prePass,
            ssaoBeforeScene ? this.ssaoPass : null,
            this.scenePass, this.colorGrabPass, this.scenePassTransparent,
            ssaoBeforeScene ? null : this.ssaoPass,
            this.volumetricFogPass, this.taaPass, this.scenePassHalf, this.bloomPass, this.dofPass, this.composePass, this.afterPass
        ];
    }

    createPasses(options) {

        // pre-pass
        this.setupScenePrepass(options);

        // ssao
        this.setupSsaoPass(options);

        // scene including color grab pass
        const scenePassesInfo = this.setupScenePass(options);

        // volumetric fog, blended into the scene render target before TAA
        this.setupVolumetricFogPass(options);

        // TAA
        const sceneTextureWithTaa = this.setupTaaPass(options);

        // downscale to half resolution
        this.setupSceneHalfPass(options, sceneTextureWithTaa);

        // bloom
        this.setupBloomPass(options, this.sceneTextureHalf);

        this.setupDofPass(options, this.sceneTexture, this.sceneTextureHalf);

        // compose
        this.setupComposePass(options);

        // after pass
        this.setupAfterPass(options, scenePassesInfo);
    }

    setupScenePrepass(options) {
        if (options.prepassEnabled) {

            const { app, device, cameraComponent } = this;
            const { scene, renderer } = app;
            this.prePass = new RenderPassPrepass(device, scene, renderer, cameraComponent, this.sceneOptions);
        }
    }

    setupScenePassSettings(pass) {
        // forward passes render in HDR
        pass.gammaCorrection = GAMMA_NONE;
        pass.toneMapping = TONEMAP_NONE;

        // only the passes rendering to the scene render target write the scene textures, so that the
        // camera's other passes, for example the one rendering the UI to the output render target, do
        // not output them
        pass.sceneTextures = this._sceneTextureNames;
    }

    /**
     * Adds the camera's layers from the pass's layer composition to a forward render pass, starting
     * from the given index, till the end of the layer list, or till the last layer with the given id
     * and transparency is reached (inclusive). Only layers that the camera renders are added.
     *
     * @param {RenderPassForward} renderPass - The forward render pass to add the layers to.
     * @param {number} startIndex - The index of the first layer to be considered for adding.
     * @param {boolean} firstLayerClears - True if the first layer added should clear the render target.
     * @param {number} [lastLayerId] - The id of the last layer to be added. If not specified, all
     * layers till the end of the layer list are added.
     * @param {boolean} [lastLayerIsTransparent] - True if the last layer to be added is transparent.
     * Defaults to true.
     * @returns {number} Returns the index of last layer added.
     */
    addCameraLayers(renderPass, startIndex, firstLayerClears, lastLayerId, lastLayerIsTransparent = true) {

        const cameraComponent = this.cameraComponent;
        const { layerList, subLayerList } = renderPass.layerComposition;
        let clearRenderTarget = firstLayerClears;

        let index = startIndex;
        while (index < layerList.length) {

            const layer = layerList[index];
            const isTransparent = subLayerList[index];

            // add it for rendering if the camera renders it
            if (cameraComponent.camera.layersSet.has(layer.id)) {
                renderPass.addLayer(cameraComponent, layer, isTransparent, clearRenderTarget);
                clearRenderTarget = false;
            }

            index++;

            // stop at last requested layer
            if (layer.id === lastLayerId && isTransparent === lastLayerIsTransparent) {
                break;
            }
        }

        return index;
    }

    setupScenePass(options) {

        const { app, device } = this;
        const { scene, renderer } = app;
        const composition = scene.layers;

        // render pass that renders the scene to the render target. Render target size automatically
        // matches the back-buffer size with the optional scale. Note that the scale parameters
        // allow us to render the 3d scene at lower resolution, improving performance.
        this.scenePass = new RenderPassForward(device, composition, scene, renderer);
        this.setupScenePassSettings(this.scenePass);
        this.scenePass.init(this.rt, this.sceneOptions);

        // layers this pass renders depend on the grab pass being used
        const lastLayerId = options.sceneColorMap ? options.lastGrabLayerId : options.lastSceneLayerId;
        const lastLayerIsTransparent = options.sceneColorMap ? options.lastGrabLayerIsTransparent : options.lastSceneLayerIsTransparent;

        // return values
        const ret = {
            lastAddedIndex: 0,          // the last layer index added to the scene pass
            clearRenderTarget: true     // true if the render target should be cleared
        };

        ret.lastAddedIndex = this.addCameraLayers(this.scenePass, ret.lastAddedIndex, ret.clearRenderTarget, lastLayerId, lastLayerIsTransparent);
        ret.clearRenderTarget = false;

        // grab pass allowing us to copy the render scene into a texture and use for refraction
        // the source for the copy is the texture we render the scene to
        if (options.sceneColorMap) {
            this.colorGrabPass = new FramePassColorGrab(device);
            this.colorGrabPass.source = this.rt;

            // if grab pass is used, render the layers after it (otherwise they were already rendered)
            this.scenePassTransparent = new RenderPassForward(device, composition, scene, renderer);
            this.setupScenePassSettings(this.scenePassTransparent);
            this.scenePassTransparent.init(this.rt);
            ret.lastAddedIndex = this.addCameraLayers(this.scenePassTransparent, ret.lastAddedIndex, ret.clearRenderTarget, options.lastSceneLayerId, options.lastSceneLayerIsTransparent);

            // if no layers are rendered by this pass, remove it
            if (!this.scenePassTransparent.rendersAnything) {
                this.scenePassTransparent.destroy();
                this.scenePassTransparent = null;
            }

            if (this.scenePassTransparent) {
                // if prepass is enabled, we need to store the depth, as by default it gets discarded
                if (options.prepassEnabled) {
                    this.scenePassTransparent.depthStencilOps.storeDepth = true;
                }
            }
        }

        // The scene textures become available once the last pass rendering to the scene render target
        // has finished, and only that pass publishes them. Publishing them from an earlier one would
        // expose an attachment of the render target the remaining passes still render into, which the
        // materials they render could then sample - reading a texture attached to the render target
        // being rendered into is not allowed.
        (this.scenePassTransparent ?? this.scenePass).sceneTexturesCamera = this.cameraComponent;

        // Without a prepass nothing has published the scene depth by the time the scene renders, so the
        // first pass clears the uniform it is published to. This has to happen as the pass renders rather
        // than when the frame is set up, as every camera's frameUpdate runs before any of them renders,
        // and so another camera could publish its own depth in between.
        this.scenePass.clearSceneTextures = options.sceneTextureDepth && !options.prepassEnabled;

        return ret;
    }

    setupSsaoPass(options) {
        const { ssaoBlurEnabled, ssaoType } = options;
        const { device, cameraComponent } = this;
        if (ssaoType !== SSAOTYPE_NONE) {
            this.ssaoPass = new RenderPassSsao(device, this.sceneTexture, cameraComponent, ssaoBlurEnabled);
        }
    }

    setupSceneHalfPass(options, sourceTexture) {

        if (this._sceneHalfEnabled) {
            this.scenePassHalf = new RenderPassDownsample(this.device, this.sceneTexture, {
                boxFilter: true,
                removeInvalid: true // remove invalid pixels to avoid bloom / dof artifacts
            });
            this.scenePassHalf.name = 'RenderPassSceneHalf';
            this.scenePassHalf.init(this.rtHalf, {
                resizeSource: sourceTexture,
                scaleX: 0.5,
                scaleY: 0.5
            });
            this.scenePassHalf.setClearColor(Color.BLACK);
        }
    }

    setupBloomPass(options, inputTexture) {

        if (this._bloomEnabled) {
            // create a bloom pass, which generates bloom texture based on the provided texture
            this.bloomPass = new FramePassBloom(this.device, inputTexture, this.hdrFormat);
        }
    }

    setupDofPass(options, inputTexture, inputTextureHalf) {
        if (options.dofEnabled)  {
            this.dofPass = new FramePassDof(this.device, this.cameraComponent, inputTexture, inputTextureHalf, options.dofHighQuality, options.dofNearBlur);
        }
    }

    setupVolumetricFogPass(options) {
        if (options.volumetricFogEnabled) {

            // the scene pass provides the light clusters used by the local lights of the fog. The fog
            // samples the scene depth, and so blends into the alias of the scene color rather than the
            // scene render target, which the depth is attached to.
            this.volumetricFogPass = new FramePassVolumetricFog(this.device, this.cameraComponent,
                this.sceneTexture, this.rtSceneColor ?? this.rt, this.scenePass);

            // when TAA is used, the fog noise pattern changes each frame and TAA resolves it
            this.volumetricFogPass.temporalDither = options.taaEnabled;
        }
    }

    setupTaaPass(options) {
        let textureWithTaa = this.sceneTexture;
        if (options.taaEnabled) {
            this.taaPass = new RenderPassTAA(this.device, this.sceneTexture, this.cameraComponent);
            textureWithTaa = this.taaPass.historyTexture;
        }

        return textureWithTaa;
    }

    setupComposePass(options) {

        // create a compose pass, which combines the results of the scene and other passes
        this.composePass = new RenderPassCompose(this.device, this.cameraComponent);
        this.composePass.bloomTexture = this.bloomPass?.bloomTexture;
        this.composePass.hdrScene = this.hdrFormat !== PIXELFORMAT_RGBA8;
        this.composePass.taaEnabled = options.taaEnabled;
        this.composePass.cocTexture = this.dofPass?.cocTexture;
        this.composePass.blurTexture = this.dofPass?.blurTexture;
        this.composePass.blurTextureUpscale = !this.dofPass?.highQuality;

        // compose pass renders directly to target renderTarget
        const cameraComponent = this.cameraComponent;
        const targetRenderTarget = cameraComponent.renderTarget;
        this.composePass.init(targetRenderTarget);

        // ssao texture as needed
        this.composePass.ssaoTexture = options.ssaoType === SSAOTYPE_COMBINE ? this.ssaoPass.ssaoTexture : null;
    }

    setupAfterPass(options, scenePassesInfo) {

        const { app, cameraComponent } = this;
        const { scene, renderer } = app;
        const composition = scene.layers;
        const targetRenderTarget = cameraComponent.renderTarget;

        // final pass renders directly to the target renderTarget on top of the bloomed scene, and it renders a transparent UI layer
        this.afterPass = new RenderPassForward(this.device, composition, scene, renderer);
        this.afterPass.init(targetRenderTarget);

        // add all remaining layers the camera renders
        this.addCameraLayers(this.afterPass, scenePassesInfo.lastAddedIndex, scenePassesInfo.clearRenderTarget);
    }

    frameUpdate() {

        // trigger update if layers were added or removed
        if (this.layersDirty) {
            this.cameraFrame.update();
        }

        super.frameUpdate();

        // Whether the depth debug mode has a depth to display. Either producer publishes to the same
        // uniform, and both have run by the time the composition does. The mode does not request the
        // depth - a debug view never changes what is rendered - so with neither producer it shows black.
        const { options, composePass } = this;
        const sceneDepthAvailable = options.sceneTextureDepth || options.prepassEnabled;
        composePass.sceneDepthAvailable = sceneDepthAvailable;

        Debug.call(() => {
            if (composePass.debug === 'depth' && !sceneDepthAvailable) {
                Debug.warnOnce('CameraFrame.debug is set to \'depth\', but nothing this camera renders produces the scene depth, so the debug view is black. Enable an effect which consumes the depth (the depth of field, the volumetric fog, TAA, or SSAO in combine mode), or request it with CameraFrame.rendering.sceneDepthMap.');
            }
        });

        if (this.sceneDepthTexture) {

            // the alias of the scene color is not resized by a pass of its own, as it shares its
            // texture with the scene render target, which the scene pass resizes
            this.rtSceneColor.resize(this.rt.width, this.rt.height);

            // cleared to the reciprocal of the far clip, which makes the background a surface at
            // that distance taking part in the average the blended geometry accumulates - whatever
            // coverage the splats leave over falls to it. That keeps a pixel a splat covers only
            // faintly reporting close to the background rather than the splat's own distance. Only the
            // first pass rendering to the scene render target clears it - the one rendering the
            // transparent layers after the grab pass blends into what the first one accumulated.
            const clearValue = this._sceneDepthClearValue;
            clearValue.r = 1 / this.cameraComponent.camera.farClip;
            this.scenePass.setClearColor(clearValue, this.sceneDepthSlot);
        }

        // scene texture is either output of taa pass or the scene render target
        const sceneTexture = this.taaPass?.update() ?? this.rt.colorBuffer;

        // TAA history buffer is double buffered, assign the current one to the follow up passes.
        this.composePass.sceneTexture = sceneTexture;
        this.scenePassHalf?.setSourceTexture(sceneTexture);
    }
}

export { FramePassCameraFrame, CameraFrameOptions };
