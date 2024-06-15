import { Color } from '../../core/math/color.js';
import { Texture } from '../../platform/graphics/texture.js';
import { BlendState } from '../../platform/graphics/blend-state.js';
import { RenderTarget } from '../../platform/graphics/render-target.js';
import { RenderPass } from '../../platform/graphics/render-pass.js';
import { FILTER_LINEAR, ADDRESS_CLAMP_TO_EDGE } from '../../platform/graphics/constants.js';

import { RenderPassDownsample } from './render-pass-downsample.js';
import { RenderPassUpsample } from './render-pass-upsample.js';

// based on https://learnopengl.com/Guest-Articles/2022/Phys.-Based-Bloom
/**
 * Render pass implementation of HDR bloom effect.
 *
 * @category Graphics
 * @ignore
 */
class RenderPassBloom extends RenderPass {
    bloomTexture;

    lastMipLevel = 1;

    bloomRenderTarget;

    textureFormat;

    renderTargets = [];

    constructor(device, sourceTexture, format) {
        super(device);
        this._sourceTexture = sourceTexture;
        this.textureFormat = format;

        this.bloomRenderTarget = this.createRenderTarget(0);
        this.bloomTexture = this.bloomRenderTarget.colorBuffer;
    }

    destroy() {
        this.destroyRenderPasses();
        this.destroyRenderTargets();
    }

    destroyRenderTargets(startIndex = 0) {
        for (let i = startIndex; i < this.renderTargets.length; i++) {
            const rt = this.renderTargets[i];
            rt.destroyTextureBuffers();
            rt.destroy();
        }
        this.renderTargets.length = 0;
    }

    destroyRenderPasses() {
        for (let i = 0; i < this.beforePasses.length; i++) {
            this.beforePasses[i].destroy();
        }
        this.beforePasses.length = 0;
    }

    createRenderTarget(index) {
        return new RenderTarget({
            depth: false,
            colorBuffer: new Texture(this.device, {
                name: `BloomTexture${index}`,
                width: 1,
                height: 1,
                format: this.textureFormat,
                mipmaps: false,
                minFilter: FILTER_LINEAR,
                magFilter: FILTER_LINEAR,
                addressU: ADDRESS_CLAMP_TO_EDGE,
                addressV: ADDRESS_CLAMP_TO_EDGE
            })
        });
    }

    createRenderTargets(count) {
        for (let i = 0; i < count; i++) {
            const rt = i === 0 ? this.bloomRenderTarget : this.createRenderTarget(i);
            this.renderTargets.push(rt);
        }
    }

    // number of levels till hitting min size
    calcMipLevels(width, height, minSize) {
        const min = Math.min(width, height);
        return Math.floor(Math.log2(min) - Math.log2(minSize));
    }

    createRenderPasses(numPasses) {

        const device = this.device;

        // progressive downscale
        let passSourceTexture = this._sourceTexture;
        for (let i = 0; i < numPasses; i++) {

            const pass = new RenderPassDownsample(device, passSourceTexture);
            const rt = this.renderTargets[i];
            pass.init(rt, {
                resizeSource: passSourceTexture,
                scaleX: 0.5,
                scaleY: 0.5
            });
            pass.setClearColor(Color.BLACK);  // clear when down-scaling
            this.beforePasses.push(pass);
            passSourceTexture = rt.colorBuffer;
        }

        // progressive upscale
        passSourceTexture = this.renderTargets[numPasses - 1].colorBuffer;
        for (let i = numPasses - 2; i >= 0; i--) {

            const pass = new RenderPassUpsample(device, passSourceTexture);
            const rt = this.renderTargets[i];
            pass.init(rt);
            pass.blendState = BlendState.ADDBLEND;  // blend when up-scaling
            this.beforePasses.push(pass);
            passSourceTexture = rt.colorBuffer;
        }
    }

    onDisable() {
        // resize down the persistent render target
        this.renderTargets[0]?.resize(1, 1);

        // release the rest
        this.destroyRenderPasses();
        this.destroyRenderTargets(1);
    }

    set sourceTexture(value) {
        this._sourceTexture = value;

        if (this.beforePasses.length > 0) {
            const firstPass = this.beforePasses[0];

            // change resize source
            firstPass.options.resizeSource = value;

            // change downsample source
            firstPass.sourceTexture = value;
        }
    }

    get sourceTexture() {
        return this._sourceTexture;
    }

    frameUpdate() {
        super.frameUpdate();

        // create an appropriate amount of render passes
        let numPasses = this.calcMipLevels(this._sourceTexture.width, this._sourceTexture.height, 2 ** this.lastMipLevel);
        numPasses = Math.max(1, numPasses);

        if (this.renderTargets.length !== numPasses) {

            this.destroyRenderPasses();
            this.destroyRenderTargets(1);
            this.createRenderTargets(numPasses);
            this.createRenderPasses(numPasses);
        }
    }
}

export { RenderPassBloom };
