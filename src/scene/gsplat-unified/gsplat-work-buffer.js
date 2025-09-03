import { Debug } from '../../core/debug.js';
import { ADDRESS_CLAMP_TO_EDGE, FILTER_NEAREST, PIXELFORMAT_R32U, PIXELFORMAT_RGBA16F } from '../../platform/graphics/constants.js';
import { RenderTarget } from '../../platform/graphics/render-target.js';
import { Texture } from '../../platform/graphics/texture.js';
import { GSplatWorkBufferRenderPass } from './gsplat-work-buffer-render-pass.js';

let id = 0;

/**
 * @import { GSplatInfo } from "./gsplat-info.js"
 * @import { GraphicsDevice } from '../../platform/graphics/graphics-device.js'
 * @import { GraphNode } from '../graph-node.js';
 */

/**
 * @ignore
 */
class GSplatWorkBuffer {
    /** @type {GraphicsDevice} */
    device;

    /** @type {number} */
    id = id++;

    /** @type {Texture} */
    colorTexture;

    /** @type {Texture} */
    covATexture;

    /** @type {Texture} */
    covBTexture;

    /** @type {Texture} */
    centerTexture;

    /** @type {RenderTarget} */
    renderTarget;

    /** @type {Texture} */
    orderTexture;

    /** @type {GSplatWorkBufferRenderPass} */
    renderPass;

    constructor(device) {
        this.device = device;

        this.colorTexture = this.createTexture('splatColor', PIXELFORMAT_RGBA16F, 1, 1);
        this.covATexture = this.createTexture('covA', PIXELFORMAT_RGBA16F, 1, 1);
        this.covBTexture = this.createTexture('covB', PIXELFORMAT_RGBA16F, 1, 1);
        this.centerTexture = this.createTexture('center', PIXELFORMAT_RGBA16F, 1, 1);

        this.renderTarget = new RenderTarget({
            name: `GsplatWorkBuffer-MRT-${this.id}`,
            colorBuffers: [this.colorTexture, this.centerTexture, this.covATexture, this.covBTexture],
            depth: false,
            flipY: true
        });

        this.orderTexture = this.createTexture('SplatGlobalOrder', PIXELFORMAT_R32U, 1, 1);

        // Create the optimized render pass for batched splat rendering
        this.renderPass = new GSplatWorkBufferRenderPass(device);
        this.renderPass.init(this.renderTarget);
    }

    destroy() {
        this.renderPass?.destroy();
        this.colorTexture?.destroy();
        this.covATexture?.destroy();
        this.covBTexture?.destroy();
        this.centerTexture?.destroy();
        this.orderTexture?.destroy();
        this.renderTarget?.destroy();
    }

    get textureSize() {
        return this.orderTexture.width;
    }

    setOrderData(data) {

        const len = this.orderTexture.width * this.orderTexture.height;
        if (len !== data.length) {
            Debug.error('setOrderData: data length mismatch, got:', data.length, 'expected:', len, `(${this.orderTexture.width}x${this.orderTexture.height})`);
        }

        // upload data to texture
        this.orderTexture._levels[0] = data;
        this.orderTexture.upload();
    }

    createTexture(name, format, w, h) {
        return new Texture(this.device, {
            name: name,
            width: w,
            height: h,
            format: format,
            cubemap: false,
            mipmaps: false,
            minFilter: FILTER_NEAREST,
            magFilter: FILTER_NEAREST,
            addressU: ADDRESS_CLAMP_TO_EDGE,
            addressV: ADDRESS_CLAMP_TO_EDGE
        });
    }

    /**
     * @param {number} textureSize - The texture size to resize to.
     */
    resize(textureSize) {
        Debug.assert(textureSize);
        this.renderTarget.resize(textureSize, textureSize);
        this.orderTexture.resize(textureSize, textureSize);
    }

    /**
     * Render given splats to the work buffer.
     *
     * @param {GSplatInfo[]} splats - The splats to render.
     * @param {GraphNode} cameraNode - The camera node.
     */
    render(splats, cameraNode) {
        // render splats using render pass
        if (this.renderPass.update(splats, cameraNode)) {
            this.renderPass.render();
        }
    }
}

export { GSplatWorkBuffer };
