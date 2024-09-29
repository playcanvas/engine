import { LAYERID_SKYBOX, LAYERID_IMMEDIATE, TONEMAP_NONE, GAMMA_NONE } from '../../scene/constants.js';
import {
    ADDRESS_CLAMP_TO_EDGE, FILTER_LINEAR, FILTER_NEAREST,
    PIXELFORMAT_DEPTH, PIXELFORMAT_R32F, PIXELFORMAT_RGBA8
} from '../../platform/graphics/constants.js';
import { Texture } from '../../platform/graphics/texture.js';
import { RenderPass } from '../../platform/graphics/render-pass.js';
import { RenderPassColorGrab } from '../../scene/graphics/render-pass-color-grab.js';
import { RenderPassForward } from '../../scene/renderer/render-pass-forward.js';
import { RenderTarget } from '../../platform/graphics/render-target.js';

import { RenderPassBloom } from './render-pass-bloom.js';
import { RenderPassCompose } from './render-pass-compose.js';
import { RenderPassTAA } from './render-pass-taa.js';
import { RenderPassPrepass } from './render-pass-prepass.js';
import { RenderPassSsao } from './render-pass-ssao.js';
import { RenderingParams } from '../../scene/renderer/rendering-params.js';

export const SSAOTYPE_NONE = 'none';
export const SSAOTYPE_LIGHTING = 'lighting';
export const SSAOTYPE_COMBINE = 'combine';

class CameraFrameOptions {
    formats;

    samples = 1;

    sceneColorMap = true;

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

    _renderTargetScale = 1;

    /**
     * @type {RenderTarget|null}
     * @private
     */
    rt = null;

    constructor(app, cameraComponent, options = {}) {
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
        this.sceneDepth = null;

        if (this.rt) {
            this.rt.destroyTextureBuffers();
            this.rt.destroy();
            this.rt = null;
        }

        // destroy all passes we created
        this.beforePasses.forEach(pass => pass.destroy());
        this.beforePasses.length = 0;

        this.prePass = null;
        this.scenePass = null;
        this.composePass = null;
        this.bloomPass = null;
        this.ssaoPass = null;
        this.taaPass = null;
    }

    sanitizeOptions(options) {
        options = Object.assign({}, _defaultOptions, options);

        // automatically enable prepass when required internally
        if (options.taaEnabled || options.ssaoType !== SSAOTYPE_NONE) {
            options.prepassEnabled = true;
        }

        return options;
    }

    set renderTargetScale(value) {
        this._renderTargetScale = value;
        if (this.scenePass) {
            this.scenePass.options.scaleX = value;
            this.scenePass.options.scaleY = value;
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
            options.bloomEnabled !== currentOptions.bloomEnabled ||
            options.prepassEnabled !== currentOptions.prepassEnabled ||
            arraysNotEqual(options.formats, currentOptions.formats);
    }

    // manually called, applies changes
    update(options) {

        options = this.sanitizeOptions(options);

        // destroy existing passes if they need to be re-created
        if (this.needsReset(options)) {
            this.reset();
        }

        // need to shallow copy the options to the instance
        this.options = options;

        // build new passes
        if (!this.sceneTexture) {
            this.setupRenderPasses(this.options);
        }
    }

    setupRenderPasses(options) {

        const { device } = this;
        const cameraComponent = this.cameraComponent;
        const targetRenderTarget = cameraComponent.renderTarget;

        this.hdrFormat = device.getRenderableHdrFormat(options.formats) || PIXELFORMAT_RGBA8;

        // camera renders in HDR mode (linear output, no tonemapping)
        if (!cameraComponent.rendering) {
            cameraComponent.rendering = new RenderingParams();
        }

        // set HDR rendering parameters
        const rendering = cameraComponent.rendering;
        rendering.gammaCorrection = GAMMA_NONE;
        rendering.toneMapping = TONEMAP_NONE;

        // set up internal rendering parameters
        rendering.ssaoEnabled = options.ssaoType === SSAOTYPE_LIGHTING;

        // create a render target to render the scene into
        this.sceneTexture = new Texture(device, {
            name: 'SceneColor',
            width: 4,
            height: 4,
            format: this.hdrFormat,
            mipmaps: false,
            minFilter: FILTER_LINEAR,
            magFilter: FILTER_LINEAR,
            addressU: ADDRESS_CLAMP_TO_EDGE,
            addressV: ADDRESS_CLAMP_TO_EDGE
        });

        // TODO: handle stencil support
        let depthFormat = PIXELFORMAT_DEPTH;
        if (options.prepassEnabled && device.isWebGPU && options.samples > 1) {
            // on WebGPU the depth format cannot be resolved, so we need to use a float format in that case
            // TODO: ideally we expose this using some option or similar public API to hide this implementation detail
            depthFormat = PIXELFORMAT_R32F;
        }

        this.sceneDepth = new Texture(device, {
            name: 'SceneDepth',
            width: 4,
            height: 4,
            format: depthFormat,
            mipmaps: false,
            minFilter: FILTER_NEAREST,
            magFilter: FILTER_NEAREST,
            addressU: ADDRESS_CLAMP_TO_EDGE,
            addressV: ADDRESS_CLAMP_TO_EDGE
        });

        this.rt = new RenderTarget({
            colorBuffer: this.sceneTexture,
            depthBuffer: this.sceneDepth,
            samples: options.samples
        });

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
        return [this.prePass, this.ssaoPass, this.scenePass, this.colorGrabPass, this.scenePassTransparent, this.taaPass, this.bloomPass, this.composePass, this.afterPass];
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

        // bloom
        this.setupBloomPass(options, sceneTextureWithTaa);

        // compose
        this.setupComposePass(options);

        // after pass
        this.setupAfterPass(options, scenePassesInfo);
    }

    setupScenePrepass(options) {
        if (options.prepassEnabled) {

            const { app, device, cameraComponent } = this;
            const { scene, renderer } = app;

            // ssao & taa need resolved depth
            const resolveDepth = this.options.ssaoType !== SSAOTYPE_NONE || this.options.taaEnabled;

            this.prePass = new RenderPassPrepass(device, scene, renderer, cameraComponent, this.sceneDepth, resolveDepth, this.sceneOptions, options.samples);
        }
    }

    setupScenePass(options) {

        const { app, device, cameraComponent } = this;
        const { scene, renderer } = app;
        const composition = scene.layers;

        // render pass that renders the scene to the render target. Render target size automatically
        // matches the back-buffer size with the optional scale. Note that the scale parameters
        // allow us to render the 3d scene at lower resolution, improving performance.
        this.scenePass = new RenderPassForward(device, composition, scene, renderer);
        this.scenePass.init(this.rt, this.sceneOptions);

        // if prepass is enabled, do not clear the depth buffer when rendering the scene, and preserve it
        if (options.prepassEnabled) {
            this.scenePass.noDepthClear = true;
            this.scenePass.depthStencilOps.storeDepth = true;
        }

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
            this.scenePassTransparent.init(this.rt);
            ret.lastAddedIndex = this.scenePassTransparent.addLayers(composition, cameraComponent, ret.lastAddedIndex, ret.clearRenderTarget, options.lastSceneLayerId, options.lastSceneLayerIsTransparent);

            // if prepass is enabled, we need to store the depth, as by default it gets discarded
            if (options.prepassEnabled) {
                this.scenePassTransparent.depthStencilOps.storeDepth = true;
            }
        }

        return ret;
    }

    setupSsaoPass(options) {
        const { camera, ssaoBlurEnabled, ssaoType } = options;
        if (ssaoType !== SSAOTYPE_NONE) {
            this.ssaoPass = new RenderPassSsao(this.device, this.sceneTexture, camera, ssaoBlurEnabled);
        }
    }

    setupBloomPass(options, inputTexture) {
        // HDR bloom is not supported on RGBA8 format
        if (options.bloomEnabled && this.hdrFormat !== PIXELFORMAT_RGBA8) {
            // create a bloom pass, which generates bloom texture based on the provided texture
            this.bloomPass = new RenderPassBloom(this.device, inputTexture, this.hdrFormat);
        }
    }

    setupTaaPass(options) {
        let textureWithTaa = this.sceneTexture;
        if (options.taaEnabled) {
            const cameraComponent = this.cameraComponent;
            this.taaPass = new RenderPassTAA(this.device, this.sceneTexture, cameraComponent);
            textureWithTaa = this.taaPass.historyTexture;
        }

        return textureWithTaa;
    }

    setupComposePass(options) {

        // create a compose pass, which combines the results of the scene and other passes
        this.composePass = new RenderPassCompose(this.device);
        this.composePass.bloomTexture = this.bloomPass?.bloomTexture;
        this.composePass.taaEnabled = options.taaEnabled;

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

        super.frameUpdate();

        // scene texture is either output of taa pass or the scene render target
        const sceneTexture = this.taaPass?.update() ?? this.rt.colorBuffer;

        // TAA history buffer is double buffered, assign the current one to the follow up passes.
        this.composePass.sceneTexture = sceneTexture;
        if (this.options.bloomEnabled && this.bloomPass) {
            this.bloomPass.sourceTexture = sceneTexture;
        }
    }
}

export { RenderPassCameraFrame, CameraFrameOptions };
