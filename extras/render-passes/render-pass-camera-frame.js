import {
    LAYERID_SKYBOX,
    LAYERID_IMMEDIATE,
    PIXELFORMAT_RGBA8,
    ADDRESS_CLAMP_TO_EDGE,
    FILTER_LINEAR,
    RenderPass,
    RenderPassColorGrab,
    RenderPassForward,
    RenderTarget,
    Texture
} from "playcanvas";
import { RenderPassBloom } from "./render-pass-bloom.js";
import { RenderPassCompose } from "./render-pass-compose.js";
import { RenderPassTAA } from "./render-pass-taa.js";

class RenderPassCameraFrame extends RenderPass {
    app;

    scenePass;

    composePass;

    bloomPass;

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
            name: 'SceneTexture',
            width: 4,
            height: 4,
            format: format,
            mipmaps: false,
            minFilter: FILTER_LINEAR,
            magFilter: FILTER_LINEAR,
            addressU: ADDRESS_CLAMP_TO_EDGE,
            addressV: ADDRESS_CLAMP_TO_EDGE
        });

        const rt = new RenderTarget({
            colorBuffer: sceneTexture,
            depth: true,
            samples: options.samples
        });
        this._rt = rt;

        // ------ SCENE RENDERING WITH OPTIONAL GRAB PASS ------

        // render pass that renders the scene to the render target. Render target size automatically
        // matches the back-buffer size with the optional scale. Note that the scale parameters
        // allow us to render the 3d scene at lower resolution, improving performance.
        this.scenePass = new RenderPassForward(device, composition, scene, renderer);
        this.scenePass.init(rt, {
            resizeSource: targetRenderTarget,
            scaleX: this.renderTargetScale,
            scaleY: this.renderTargetScale
        });

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
        }

        // ------ TAA ------

        let taaPass;
        let sceneTextureWithTaa = sceneTexture;
        if (options.taaEnabled) {
            taaPass = new RenderPassTAA(device, sceneTexture);
            sceneTextureWithTaa = taaPass.accumulationTexture;
        }

        // ------ BLOOM GENERATION ------

        // create a bloom pass, which generates bloom texture based on the just rendered scene texture
        this.bloomPass = new RenderPassBloom(app.graphicsDevice, sceneTextureWithTaa, format);

        // ------ COMPOSITION ------

        // create a compose pass, which combines the scene texture with the bloom texture
        this.composePass = new RenderPassCompose(app.graphicsDevice);
        this.composePass.sceneTexture = sceneTextureWithTaa;
        this.composePass.bloomTexture = this.bloomPass.bloomTexture;

        // compose pass renders directly to target renderTarget
        this.composePass.init(targetRenderTarget);

        // ------ AFTER COMPOSITION RENDERING ------

        // final pass renders directly to the target renderTarget on top of the bloomed scene, and it renders a transparent UI layer
        const afterPass = new RenderPassForward(device, composition, scene, renderer);
        afterPass.init(targetRenderTarget);

        // add all remaining layers the camera renders
        afterPass.addLayers(composition, cameraComponent, lastAddedIndex, clearRenderTarget);

        // use these prepared render passes in the order they should be executed
        const allPasses = [this.scenePass, colorGrabPass, scenePassTransparent, taaPass, this.bloomPass, this.composePass, afterPass];
        this.beforePasses = allPasses.filter(element => element !== undefined);
    }
}

export { RenderPassCameraFrame };
