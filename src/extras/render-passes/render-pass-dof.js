import { Color } from '../../core/math/color.js';
import { Texture } from '../../platform/graphics/texture.js';
import { RenderTarget } from '../../platform/graphics/render-target.js';
import { RenderPass } from '../../platform/graphics/render-pass.js';
import { FILTER_LINEAR, ADDRESS_CLAMP_TO_EDGE, PIXELFORMAT_RG8, PIXELFORMAT_R8 } from '../../platform/graphics/constants.js';

import { RenderPassDownsample } from './render-pass-downsample.js';
import { RenderPassCoC } from './render-pass-coc.js';
import { RenderPassDofBlur } from './render-pass-dof-blur.js';

/**
 * @import { GraphicsDevice } from '../../platform/graphics/graphics-device.js'
 * @import { CameraComponent } from '../../framework/components/camera/component.js'
 */

/**
 * Render pass implementation of Depth of Field effect.
 *
 * @category Graphics
 * @ignore
 */
class RenderPassDof extends RenderPass {
    focusDistance = 100;

    focusRange = 50;

    blurRadius = 1;

    blurRings = 3;

    blurRingPoints = 3;

    highQuality = true;

    /** @type {Texture|null} */
    cocTexture = null;

    /** @type {Texture|null} */
    blurTexture = null;

    /** @type {RenderPassCoC|null} */
    cocPass = null;

    /** @type {RenderPassDownsample|null} */
    farPass = null;

    /** @type {RenderPassDofBlur|null} */
    blurPass = null;

    /**
     * @param {GraphicsDevice} device - The graphics device.
     * @param {CameraComponent} cameraComponent - The camera component.
     * @param {Texture} sceneTexture - The full resolution texture.
     * @param {Texture} sceneTextureHalf - The half resolution texture.
     * @param {boolean} highQuality - Whether to use high quality setup.
     * @param {boolean} nearBlur - Whether to apply near blur.
     */
    constructor(device, cameraComponent, sceneTexture, sceneTextureHalf, highQuality, nearBlur) {
        super(device);
        this.highQuality = highQuality;

        // full resolution CoC texture
        this.cocPass = this.setupCocPass(device, cameraComponent, sceneTexture, nearBlur);
        this.beforePasses.push(this.cocPass);

        // prepare the source image for the background blur, half or quarter resolution
        const sourceTexture = highQuality ? sceneTexture : sceneTextureHalf;
        this.farPass = this.setupFarPass(device, sourceTexture, 0.5);
        this.beforePasses.push(this.farPass);

        // blur pass - based on CoC, blur either the foreground or the background texture
        // High quality: far texture was already resized from full to half resolution
        // Low quality: far texture was resized from half to quarter resolution
        // In both cases, the near texture is supplied scene half resolution
        // the result is a blurred texture, full or quarter resolution based on quality
        this.blurPass = this.setupBlurPass(device, sceneTextureHalf, nearBlur, highQuality ? 2 : 0.5);
        this.beforePasses.push(this.blurPass);
    }

    destroy() {
        this.destroyRenderPasses();
        this.cocPass = null;
        this.farPass = null;
        this.blurPass = null;

        this.destroyRT(this.cocRT);
        this.destroyRT(this.farRt);
        this.destroyRT(this.blurRt);
        this.cocRT = null;
        this.farRt = null;
        this.blurRt = null;
    }

    destroyRenderPasses() {
        for (let i = 0; i < this.beforePasses.length; i++) {
            this.beforePasses[i].destroy();
        }
        this.beforePasses.length = 0;
    }

    destroyRT(rt) {
        if (rt) {
            rt.destroyTextureBuffers();
            rt.destroy();
        }
    }

    setupCocPass(device, cameraComponent, sourceTexture, nearBlur) {

        // render full resolution CoC texture, R - far CoC, G - near CoC
        // when near blur is not enabled, we only need format with R channel
        const format = nearBlur ? PIXELFORMAT_RG8 : PIXELFORMAT_R8;
        this.cocRT = this.createRenderTarget('CoCTexture', format);
        this.cocTexture = this.cocRT.colorBuffer;

        const cocPass = new RenderPassCoC(device, cameraComponent, nearBlur);
        cocPass.init(this.cocRT, {
            resizeSource: sourceTexture
        });
        cocPass.setClearColor(Color.BLACK);
        return cocPass;
    }

    setupFarPass(device, sourceTexture, scale) {

        // Premultiply coc for far blur, to limit the sharp objects leaking into the background
        this.farRt = this.createRenderTarget('FarDofTexture', sourceTexture.format);
        const farPass = new RenderPassDownsample(device, sourceTexture, {
            boxFilter: true,
            premultiplyTexture: this.cocTexture,
            premultiplySrcChannel: 'r' // far CoC
        });

        farPass.init(this.farRt, {
            resizeSource: sourceTexture,
            scaleX: scale,
            scaleY: scale
        });
        farPass.setClearColor(Color.BLACK);
        return farPass;
    }

    setupBlurPass(device, nearTexture, nearBlur, scale) {
        const farTexture = this.farRt?.colorBuffer;
        this.blurRt = this.createRenderTarget('DofBlurTexture', nearTexture.format);
        this.blurTexture = this.blurRt.colorBuffer;
        const blurPass = new RenderPassDofBlur(device, nearBlur ? nearTexture : null, farTexture, this.cocTexture);
        blurPass.init(this.blurRt, {
            resizeSource: nearTexture,
            scaleX: scale,
            scaleY: scale

        });
        blurPass.setClearColor(Color.BLACK);
        return blurPass;
    }

    createTexture(name, format) {
        return new Texture(this.device, {
            name: name,
            width: 1,
            height: 1,
            format: format,
            mipmaps: false,
            minFilter: FILTER_LINEAR,
            magFilter: FILTER_LINEAR,
            addressU: ADDRESS_CLAMP_TO_EDGE,
            addressV: ADDRESS_CLAMP_TO_EDGE
        });
    }

    createRenderTarget(name, format) {
        return new RenderTarget({
            colorBuffer: this.createTexture(name, format),
            depth: false,
            stencil: false
        });
    }

    frameUpdate() {
        super.frameUpdate();

        this.cocPass.focusDistance = this.focusDistance;
        this.cocPass.focusRange = this.focusRange;

        // adjust blur sizes to give us the same results regardless of the quality (resolution)
        this.blurPass.blurRadiusNear = this.blurRadius;
        this.blurPass.blurRadiusFar = this.blurRadius * (this.highQuality ? 1 : 0.5);

        this.blurPass.blurRings = this.blurRings;
        this.blurPass.blurRingPoints = this.blurRingPoints;
    }
}

export { RenderPassDof };
