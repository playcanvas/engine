import { Texture } from '../texture.js';

/**
 * A Null implementation of the RenderTarget.
 *
 * @ignore
 */
class NullRenderTarget {
    initialized = false;

    /** @type {Texture[]} */
    _msColorBuffers = [];

    destroy(device) {
        this.initialized = false;
        this._msColorBuffers.forEach(texture => texture.destroy());
        this._msColorBuffers = [];
    }

    init(device, renderTarget) {
        this.initialized = true;
        this._msColorBuffers.forEach(texture => texture.destroy());
        this._msColorBuffers = [];
        if (renderTarget.bindMultisampled) {
            const count = renderTarget.colorBufferCount;
            for (let i = 0; i < count; i++) {
                const colorBuffer = renderTarget.getColorBuffer(i);
                this._msColorBuffers[i] = new Texture(device, {
                    name: `${renderTarget.name}.multisampledColor${i}`,
                    width: renderTarget.width,
                    height: renderTarget.height,
                    format: colorBuffer.format,
                    mipmaps: false,
                    _samples: renderTarget.samples
                });
            }
        }
    }

    /**
     * @param {number} index - Color attachment index.
     * @returns {Texture|null} The bindable MSAA color texture, or null.
     */
    getMultisampledColorBuffer(index) {
        return this._msColorBuffers[index] ?? null;
    }

    loseContext() {
        this.initialized = false;
        this._msColorBuffers.forEach(texture => texture.destroy());
        this._msColorBuffers = [];
    }

    resolve(device, target, color, depth) {
    }
}

export { NullRenderTarget };
