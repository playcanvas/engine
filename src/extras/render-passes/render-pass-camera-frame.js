import { LAYERID_SKYBOX, LAYERID_IMMEDIATE, TONEMAP_NONE, GAMMA_NONE } from '../../scene/constants.js';
import {
    ADDRESS_CLAMP_TO_EDGE,
    FILTER_LINEAR,
    FILTER_NEAREST,
    PIXELFORMAT_DEPTH,
    PIXELFORMAT_RGBA8
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
import { Debug } from '../../core/debug.js';

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

    _bloomEnabled = false;

    _ssaoEnabled = false;

    _renderTargetScale = 1;

    /**
     * @type {RenderTarget}
     * @private
     */
    rt = null;

    constructor(app, options = {}) {
        super(app.graphicsDevice);
        this.app = app;
        this.options = this.sanitizeOptions(options);

        this.setupRenderPasses(this.options);
    }

    destroy() {

        this.sceneTexture = null;
        this.sceneDepth = null;

        if (this.rt) {
            this.rt.destroyTextureBuffers();
            this.rt.destroy();
            this.rt = null;
        }

        // destroy all passes we created
        this.beforePasses.forEach(pass => pass.destroy());
        this.beforePasses = null;
    }

    sanitizeOptions(options) {

        const defaults = {
            camera: null,
            samples: 2,
            sceneColorMap: true,

            // skybox is the last layer rendered before the grab passes
            lastGrabLayerId: LAYERID_SKYBOX,
            lastGrabLayerIsTransparent: false,

            // immediate layer is the last layer rendered before the post-processing
            lastSceneLayerId: LAYERID_IMMEDIATE,
            lastSceneLayerIsTransparent: true,

            // TAA
            taaEnabled: false,

            // Bloom
            bloomEnabled: false,

            // SSAO
            ssaoEnabled: false,
            ssaoBlurEnabled: true
        };

        return Object.assign({}, defaults, options);
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

    get bloomEnabled() {
        return this._bloomEnabled;
    }

    set ssaoEnabled(value) {
        if (this._ssaoEnabled !== value) {
            this._ssaoEnabled = value;
            this.composePass.ssaoTexture = value ? this.ssaoPass.ssaoTexture : null;
            this.ssaoPass.enabled = value;
        }
    }

    get ssaoEnabled() {
        return this._ssaoEnabled;
    }

    set lastMipLevel(value) {
        this.bloomPass.lastMipLevel = value;
    }

    get lastMipLevel() {
        return this.bloomPass.lastMipLevel;
    }

    setupRenderPasses(options) {

        const { device } = this;
        const cameraComponent = options.camera;
        const targetRenderTarget = cameraComponent.renderTarget;

        this.hdrFormat = device.getRenderableHdrFormat() || PIXELFORMAT_RGBA8;

        // camera renders in HDR mode (linear output, no tonemapping)
        if (!cameraComponent.rendering) {
            const renderingParams = new RenderingParams();
            renderingParams.gammaCorrection = GAMMA_NONE;
            renderingParams.toneMapping = TONEMAP_NONE;
            cameraComponent.rendering = renderingParams;
        }

        Debug.call(() => {
            const renderingParams = cameraComponent.rendering;
            if (renderingParams.gammaCorrection !== GAMMA_NONE || renderingParams.toneMapping !== TONEMAP_NONE) {
                Debug.error('Camera rendering parameters are not set to HDR mode: GAMMA_NONE and TONEMAP_NONE');
            }
        });

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

        this.sceneDepth = new Texture(device, {
            name: 'SceneDepth',
            width: 4,
            height: 4,
            format: PIXELFORMAT_DEPTH,  // TODO: handle stencil support
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
        this.beforePasses = allPasses.filter(element => element !== undefined);
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

            const { app, device } = this;
            const { scene, renderer } = app;
            const cameraComponent = options.camera;

            this.prePass = new RenderPassPrepass(device, scene, renderer, cameraComponent, this.sceneDepth, this.sceneOptions);
        }
    }

    setupScenePass(options) {

        const { app, device } = this;
        const { scene, renderer } = app;
        const composition = scene.layers;
        const cameraComponent = options.camera;

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
        const { camera, ssaoBlurEnabled, ssaoEnabled } = options;
        if (ssaoEnabled) {
            this.ssaoPass = new RenderPassSsao(this.device, this.sceneTexture, camera, ssaoBlurEnabled);
        }
    }

    setupBloomPass(options, inputTexture) {
        if (options.bloomEnabled) {
            // create a bloom pass, which generates bloom texture based on the provided texture
            this.bloomPass = new RenderPassBloom(this.device, inputTexture, this.hdrFormat);
        }
    }

    setupTaaPass(options) {
        let textureWithTaa = this.sceneTexture;
        if (options.taaEnabled) {
            const cameraComponent = options.camera;
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
        const cameraComponent = options.camera;
        const targetRenderTarget = cameraComponent.renderTarget;
        this.composePass.init(targetRenderTarget);
    }

    setupAfterPass(options, scenePassesInfo) {

        const { app } = this;
        const { scene, renderer } = app;
        const composition = scene.layers;
        const cameraComponent = options.camera;
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
        if (this.bloomEnabled) {
            this.bloomPass.sourceTexture = sceneTexture;
        }
    }
}

export { RenderPassCameraFrame };
