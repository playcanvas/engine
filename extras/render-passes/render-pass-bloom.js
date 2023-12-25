import {
    Color,
    Texture,
    BlendState,
    RenderTarget,
    RenderPass,
    FILTER_LINEAR, ADDRESS_CLAMP_TO_EDGE
} from "playcanvas";
import { RenderPassDownSample } from "./render-pass-downsample.js";
import { RenderPassUpSample } from "./render-pass-upsample.js";

// based on https://learnopengl.com/Guest-Articles/2022/Phys.-Based-Bloom

class RenderPassBloom extends RenderPass {
    bloomTexture;

    lastMipLevel = 1;

    bloomRenderTarget;

    textureFormat;

    renderTargets = [];

    constructor(device, sourceTexture, format) {
        super(device);
        this.sourceTexture = sourceTexture;
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
        let passSourceTexture = this.sourceTexture;
        for (let i = 0; i < numPasses; i++) {

            const pass = new RenderPassDownSample(device, passSourceTexture);
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

            const pass = new RenderPassUpSample(device, passSourceTexture);
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

    frameUpdate() {
        super.frameUpdate();

        // create an appropriate amount of render passes
        let numPasses = this.calcMipLevels(this.sourceTexture.width, this.sourceTexture.height, 2 ** this.lastMipLevel);
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
