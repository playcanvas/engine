import { ADDRESS_CLAMP_TO_EDGE, FILTER_NEAREST, PIXELFORMAT_R32U, PIXELFORMAT_RGBA16F } from '../../../platform/graphics/constants.js';
import { RenderTarget } from '../../../platform/graphics/render-target.js';
import { Texture } from '../../../platform/graphics/texture.js';

/**
 * @import { GSplatInfo } from "./gsplat-info.js"
 * @import { GraphicsDevice } from '../../../platform/graphics/graphics-device.js'
 */

/**
 * @ignore
 */
class GSplatWorkBuffer {
    /** @type {GraphicsDevice} */
    device;

    /** @type {Texture} */
    colorTexture;

    /** @type {Texture} */
    transformATexture;

    /** @type {Texture} */
    transformBTexture;

    /** @type {Texture} */
    orderTexture;

    /** @type {RenderTarget} */
    renderTarget;

    constructor(device) {
        this.device = device;
    }

    destroy() {
        this.colorTexture?.destroy();
        this.transformATexture?.destroy();
        this.transformBTexture?.destroy();
        this.orderTexture?.destroy();
        this.renderTarget?.destroy();
    }

    get width() {
        return this.orderTexture.width;
    }

    get height() {
        return this.orderTexture.height;
    }

    createTexture(name, format, w, h) {
        return new Texture(this.device, {
            name: name,
            width: w,
            height: w,
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
     * @param {GSplatInfo[]} splats - The splats to the space for allocate.
     */
    allocate(splats) {
        const textureSize = this.estimateTextureWidth(splats, this.device.maxTextureSize);

        this.colorTexture = this.createTexture('splatColor', PIXELFORMAT_RGBA16F, textureSize, textureSize);
        this.covATexture = this.createTexture('covA', PIXELFORMAT_RGBA16F, textureSize, textureSize);
        this.covBTexture = this.createTexture('covB', PIXELFORMAT_RGBA16F, textureSize, textureSize);
        this.centerTexture = this.createTexture('center', PIXELFORMAT_RGBA16F, textureSize, textureSize);
        this.orderTexture = this.createTexture('SplatGlobalOrder', PIXELFORMAT_R32U, textureSize, textureSize);

        this.renderTarget = new RenderTarget({
            name: 'GsplatWorkBuffer-MRT',
            colorBuffers: [this.colorTexture, this.centerTexture, this.covATexture, this.covBTexture],
            depth: false,
            flipY: true
        });
    }

    /**
     * Estimates the minimal texture size width that can store all splats, using a fixed max texture
     * height and binary search over width.
     *
     * @param {GSplatInfo[]} splats - The splats to the space for allocate.
     * @param {number} maxSize - Max texture width and height.
     * @returns {number | null} - Size of a square texture or null if it can't fit.
     */
    estimateTextureWidth(splats, maxSize) {
        const fits = (size) => {
            let rows = 0;
            for (const splat of splats) {
                rows += Math.ceil(splat.numSplats / size);
                if (rows > size) return false;
            }
            return true;
        };

        let low = 1;
        let high = maxSize;
        let bestSize = null;

        while (low <= high) {
            const mid = Math.floor((low + high) / 2);
            if (fits(mid)) {
                bestSize = mid;
                high = mid - 1;
            } else {
                low = mid + 1;
            }
        }

        return bestSize;
    }

    /**
     * Render given splats to the work buffer.
     *
     * @param {GSplatInfo[]} splats - The splats to render.
     */
    render(splats) {
        splats.forEach((splat) => {
            splat.render(this.renderTarget);
        });
    }
}

export { GSplatWorkBuffer };
