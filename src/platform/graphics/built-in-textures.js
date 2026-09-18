import { PIXELFORMAT_RGBA8 } from './constants.js';
import { Texture } from './texture.js';

/**
 * @import { GraphicsDevice } from './graphics-device.js'
 */

/**
 * A set of 1x1 textures the engine binds in place of a texture it was not given - a material's
 * texture that has not finished loading, or a shader's texture slot with no value at all.
 *
 * These are owned by the {@link GraphicsDevice} and created together with it, as they cannot be
 * created on demand: creating a texture uploads its data, and on WebGPU an upload submits the
 * scheduled command buffers, which finishes the command encoder an in-flight render pass belongs
 * to.
 *
 * @ignore
 */
class BuiltInTextures {
    /**
     * An opaque white texture.
     *
     * @type {Texture}
     */
    white;

    /**
     * An opaque mid-gray texture.
     *
     * @type {Texture}
     */
    gray;

    /**
     * An opaque black texture.
     *
     * @type {Texture}
     */
    black;

    /**
     * A texture storing a tangent space normal pointing straight out of the surface.
     *
     * @type {Texture}
     */
    normal;

    /**
     * An opaque pink texture, used where the missing texture is a mistake and so is better off
     * obvious on the screen.
     *
     * @type {Texture}
     */
    pink;

    /**
     * @param {GraphicsDevice} device - The graphics device.
     */
    constructor(device) {

        // a 1x1 texture of a single color, uploaded by the constructor
        const create = (name, color) => Texture.createDataTexture2D(
            device, `built-in-texture-${name}`, 1, 1, PIXELFORMAT_RGBA8, [new Uint8Array(color)]
        );

        this.white = create('white', [255, 255, 255, 255]);
        this.gray = create('gray', [128, 128, 128, 255]);
        this.black = create('black', [0, 0, 0, 255]);
        this.normal = create('normal', [128, 128, 255, 255]);
        this.pink = create('pink', [255, 128, 255, 255]);
    }

    destroy() {
        this.white.destroy();
        this.gray.destroy();
        this.black.destroy();
        this.normal.destroy();
        this.pink.destroy();
    }
}

export { BuiltInTextures };
