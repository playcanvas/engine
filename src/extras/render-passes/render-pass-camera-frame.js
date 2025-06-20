import { LAYERID_SKYBOX, LAYERID_IMMEDIATE, TONEMAP_NONE, GAMMA_NONE } from '../../scene/constants.js';
import { ADDRESS_CLAMP_TO_EDGE, FILTER_LINEAR, PIXELFORMAT_RGBA8 } from '../../platform/graphics/constants.js';
import { Texture } from '../../platform/graphics/texture.js';
import { RenderPass } from '../../platform/graphics/render-pass.js';
import { RenderPassColorGrab } from '../../scene/graphics/render-pass-color-grab.js';
import { RenderPassForward } from '../../scene/renderer/render-pass-forward.js';
import { RenderTarget } from '../../platform/graphics/render-target.js';

import { RenderPassBloom } from './render-pass-bloom.js';
import { RenderPassCompose } from './render-pass-compose.js';
import { RenderPassTAA } from './render-pass-taa.js';
import { RenderPassDof } from './render-pass-dof.js';
import { RenderPassPrepass } from './render-pass-prepass.js';
import { RenderPassSsao } from './render-pass-ssao.js';
import { SSAOTYPE_COMBINE, SSAOTYPE_LIGHTING, SSAOTYPE_NONE } from './constants.js';
import { Debug } from '../../core/debug.js';
import { RenderPassDownsample } from './render-pass-downsample.js';
import { Color } from '../../core/math/color';

/**
 * Options used to configure the RenderPassCameraFrame. To modify these options, you must create
 * a new instance of the RenderPassCameraFrame with the desired settings.
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

    // DOF
    dofEnabled = false;

    dofNearBlur = false;

    dofHighQuality = true;
}

const _defaultOptions = new CameraFrameOptions();

/**
 * Render pass implementation of a common camera frame rendering with integrated  post-processing
 * effects.
 *
 * @category Graphics
 * @ignore
 */
class RenderPassCameraFrame extends RenderPass {
    app;

    prePass;

    scenePass;

    composePass;

    bloomPass;

    ssaoPass;

    taaPass;

    scenePassHalf;

    dofPass;

    _renderTargetScale = 1;

    /**
     * True if the render pass needs to be re-created because layers have been added or removed.
     *
     * @type {boolean}
     * @ignore
     */
    layersDirty = false;

    /**
     * @type {RenderTarget|null}
     * @private
     */
    rt = null;

    constructor(app, cameraComponent, options = {}) {
        Debug.assert(app);
        super(app.graphicsDevice);
        this.app = app;
        this.cameraComponent = cameraComponent;

        this.options = this.sanitizeOptions(options);
        this.setupRenderPasses(this.options);
    }

    destroy() {
        this.reset();
    }

    reset() {

        this.sceneTexture = null;
        this.sceneTextureHalf = null;

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
    }

    sanitizeOptions(options) {
        options = Object.assign({}, _defaultOptions, options);

        // automatically enable prepass when required internally
        if (options.taaEnabled || options.ssaoType !== SSAOTYPE_NONE || options.dofEnabled) {
            options.prepassEnabled = true;
        }

        return options;
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
            options.sceneColorMap !== currentOptions.sceneColorMap ||
            options.dofEnabled !== currentOptions.dofEnabled ||
            options.dofNearBlur !== currentOptions.dofNearBlur ||
            options.dofHighQuality !== currentOptions.dofHighQuality ||
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

    createRenderTarget(name, depth, stencil, samples, flipY) {

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
            colorBuffer: texture,
            depth: depth,
            stencil: stencil,
            samples: samples,
            flipY: flipY
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

        // create a render target to render the scene into
        const flipY = !!targetRenderTarget?.flipY; // flipY is inherited from the target renderTarget
        this.rt = this.createRenderTarget('SceneColor', true, options.stencil, options.samples, flipY);
        this.sceneTexture = this.rt.colorBuffer;

        // when half size scene color buffer is used
        if (this._sceneHalfEnabled) {
            this.rtHalf = this.createRenderTarget('SceneColorHalf', false, false, 1, flipY);
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
    }

    collectPasses() {

        // use these prepared render passes in the order they should be executed
        return [this.prePass, this.ssaoPass, this.scenePass, this.colorGrabPass, this.scenePassTransparent, this.taaPass, this.scenePassHalf, this.bloomPass, this.dofPass, this.composePass, this.afterPass];
    }

    createPasses(options) {

        // pre-pass
        this.setupScenePrepass(options);

        // ssao
        this.setupSsaoPass(options);

        // scene including color grab pass
        const scenePassesInfo = this.setupScenePass(options);

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
    }

    setupScenePass(options) {

        const { app, device, cameraComponent } = this;
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

        ret.lastAddedIndex = this.scenePass.addLayers(composition, cameraComponent, ret.lastAddedIndex, ret.clearRenderTarget, lastLayerId, lastLayerIsTransparent);
        ret.clearRenderTarget = false;

        // grab pass allowing us to copy the render scene into a texture and use for refraction
        // the source for the copy is the texture we render the scene to
        if (options.sceneColorMap) {
            this.colorGrabPass = new RenderPassColorGrab(device);
            this.colorGrabPass.source = this.rt;

            // if grab pass is used, render the layers after it (otherwise they were already rendered)
            this.scenePassTransparent = new RenderPassForward(device, composition, scene, renderer);
            this.setupScenePassSettings(this.scenePassTransparent);
            this.scenePassTransparent.init(this.rt);
            ret.lastAddedIndex = this.scenePassTransparent.addLayers(composition, cameraComponent, ret.lastAddedIndex, ret.clearRenderTarget, options.lastSceneLayerId, options.lastSceneLayerIsTransparent);

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
            this.bloomPass = new RenderPassBloom(this.device, inputTexture, this.hdrFormat);
        }
    }

    setupDofPass(options, inputTexture, inputTextureHalf) {
        if (options.dofEnabled)  {
            this.dofPass = new RenderPassDof(this.device, this.cameraComponent, inputTexture, inputTextureHalf, options.dofHighQuality, options.dofNearBlur);
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
        this.composePass = new RenderPassCompose(this.device);
        this.composePass.bloomTexture = this.bloomPass?.bloomTexture;
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
        this.afterPass.addLayers(composition, cameraComponent, scenePassesInfo.lastAddedIndex, scenePassesInfo.clearRenderTarget);
    }

    frameUpdate() {

        // trigger update if layers were added or removed
        if (this.layersDirty) {
            this.update(this.options);
        }

        super.frameUpdate();

        // scene texture is either output of taa pass or the scene render target
        const sceneTexture = this.taaPass?.update() ?? this.rt.colorBuffer;

        // TAA history buffer is double buffered, assign the current one to the follow up passes.
        this.composePass.sceneTexture = sceneTexture;
        this.scenePassHalf?.setSourceTexture(sceneTexture);
    }
}

export { RenderPassCameraFrame, CameraFrameOptions };
