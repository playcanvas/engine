import { LAYERID_SKYBOX, LAYERID_IMMEDIATE } from '../../scene/constants.js';
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

/**
 * @category Graphics
 */
class RenderPassCameraFrame extends RenderPass {
    app;

    prePass;

    scenePass;

    composePass;

    bloomPass;

    taaPass;

    _bloomEnabled = true;

    _renderTargetScale = 1;

    /**
     * @type {RenderTarget}
     * @private
     */
    _rt = null;

    constructor(app, options = {}) {
        super(app.graphicsDevice);
        this.app = app;
        this.options = this.sanitizeOptions(options);

        this.setupRenderPasses(this.options);
    }

    destroy() {

        if (this._rt) {
            this._rt.destroyTextureBuffers();
            this._rt.destroy();
            this._rt = null;
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
            taaEnabled: false
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

    set bloomEnabled(value) {
        if (this._bloomEnabled !== value) {
            this._bloomEnabled = value;
            this.composePass.bloomTexture = value ? this.bloomPass.bloomTexture : null;
            this.bloomPass.enabled = value;
        }
    }

    get bloomEnabled() {
        return this._bloomEnabled;
    }

    set lastMipLevel(value) {
        this.bloomPass.lastMipLevel = value;
    }

    get lastMipLevel() {
        return this.bloomPass.lastMipLevel;
    }

    setupRenderPasses(options) {

        const { app, device } = this;
        const { scene, renderer } = app;
        const composition = scene.layers;
        const cameraComponent = options.camera;
        const targetRenderTarget = cameraComponent.renderTarget;

        // create a render target to render the scene into
        const format = device.getRenderableHdrFormat() || PIXELFORMAT_RGBA8;
        const sceneTexture = new Texture(device, {
            name: 'SceneColor',
            width: 4,
            height: 4,
            format: format,
            mipmaps: false,
            minFilter: FILTER_LINEAR,
            magFilter: FILTER_LINEAR,
            addressU: ADDRESS_CLAMP_TO_EDGE,
            addressV: ADDRESS_CLAMP_TO_EDGE
        });

        const sceneDepth = new Texture(device, {
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

        const rt = new RenderTarget({
            colorBuffer: sceneTexture,
            depthBuffer: sceneDepth,
            samples: options.samples
        });
        this._rt = rt;

        const sceneOptions = {
            resizeSource: targetRenderTarget,
            scaleX: this.renderTargetScale,
            scaleY: this.renderTargetScale
        };

        // ------ SCENE PREPASS ------

        if (options.prepassEnabled) {
            this.prePass = new RenderPassPrepass(device, scene, renderer, cameraComponent, sceneDepth, sceneOptions);
        }

        // ------ SCENE RENDERING WITH OPTIONAL GRAB PASS ------

        // render pass that renders the scene to the render target. Render target size automatically
        // matches the back-buffer size with the optional scale. Note that the scale parameters
        // allow us to render the 3d scene at lower resolution, improving performance.
        this.scenePass = new RenderPassForward(device, composition, scene, renderer);
        this.scenePass.init(rt, sceneOptions);

        // if prepass is enabled, do not clear the depth buffer when rendering the scene, and preserve it
        if (options.prepassEnabled) {
            this.scenePass.noDepthClear = true;
            this.scenePass.depthStencilOps.storeDepth = true;
        }

        // layers this pass renders depend on the grab pass being used
        const lastLayerId = options.sceneColorMap ? options.lastGrabLayerId : options.lastSceneLayerId;
        const lastLayerIsTransparent = options.sceneColorMap ? options.lastGrabLayerIsTransparent : options.lastSceneLayerIsTransparent;

        let clearRenderTarget = true;
        let lastAddedIndex = 0;
        lastAddedIndex = this.scenePass.addLayers(composition, cameraComponent, lastAddedIndex, clearRenderTarget, lastLayerId, lastLayerIsTransparent);
        clearRenderTarget = false;

        // grab pass allowing us to copy the render scene into a texture and use for refraction
        // the source for the copy is the texture we render the scene to
        let colorGrabPass;
        let scenePassTransparent;
        if (options.sceneColorMap) {
            colorGrabPass = new RenderPassColorGrab(device);
            colorGrabPass.source = rt;

            // if grab pass is used, render the layers after it (otherwise they were already rendered)
            scenePassTransparent = new RenderPassForward(device, composition, scene, renderer);
            scenePassTransparent.init(rt);
            lastAddedIndex = scenePassTransparent.addLayers(composition, cameraComponent, lastAddedIndex, clearRenderTarget, options.lastSceneLayerId, options.lastSceneLayerIsTransparent);

            // if prepass is enabled, we need to store the depth, as by default it gets discarded
            if (options.prepassEnabled) {
                scenePassTransparent.depthStencilOps.storeDepth = true;
            }
        }

        // ------ TAA ------

        let sceneTextureWithTaa = sceneTexture;
        if (options.taaEnabled) {
            this.taaPass = new RenderPassTAA(device, sceneTexture, cameraComponent);
            sceneTextureWithTaa = this.taaPass.historyTexture;
        }

        // ------ BLOOM GENERATION ------

        // create a bloom pass, which generates bloom texture based on the just rendered scene texture
        this.bloomPass = new RenderPassBloom(app.graphicsDevice, sceneTextureWithTaa, format);

        // ------ COMPOSITION ------

        // create a compose pass, which combines the scene texture with the bloom texture
        this.composePass = new RenderPassCompose(app.graphicsDevice);
        this.composePass.bloomTexture = this.bloomPass.bloomTexture;
        this.composePass.taaEnabled = options.taaEnabled;

        // compose pass renders directly to target renderTarget
        this.composePass.init(targetRenderTarget);

        // ------ AFTER COMPOSITION RENDERING ------

        // final pass renders directly to the target renderTarget on top of the bloomed scene, and it renders a transparent UI layer
        const afterPass = new RenderPassForward(device, composition, scene, renderer);
        afterPass.init(targetRenderTarget);

        // add all remaining layers the camera renders
        afterPass.addLayers(composition, cameraComponent, lastAddedIndex, clearRenderTarget);

        // use these prepared render passes in the order they should be executed
        const allPasses = [this.prePass, this.scenePass, colorGrabPass, scenePassTransparent, this.taaPass, this.bloomPass, this.composePass, afterPass];
        this.beforePasses = allPasses.filter(element => element !== undefined);
    }

    frameUpdate() {

        super.frameUpdate();

        // scene texture is either output of taa pass or the scene render target
        const sceneTexture = this.taaPass?.update() ?? this._rt.colorBuffer;

        // TAA history buffer is double buffered, assign the current one to the follow up passes.
        this.composePass.sceneTexture = sceneTexture;
        if (this.bloomEnabled) {
            this.bloomPass.sourceTexture = sceneTexture;
        }
    }
}

export { RenderPassCameraFrame };
