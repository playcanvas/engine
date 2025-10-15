/**
 * @import { GraphicsDevice } from './graphics-device.js'
 * @import { StorageBuffer } from './storage-buffer.js'
 * @import { Texture } from './texture.js'
 */

/**
 * Manages non-blocking uploads of data to GPU resources (textures or storage buffers).
 * Internally pools staging resources (PBOs on WebGL, staging buffers on WebGPU) to avoid blocking
 * when the GPU is busy with previous uploads.
 *
 * Important: Create one UploadStream per target resource.
 *
 * @category Graphics
 * @ignore
 */
class UploadStream {
    /**
     * Create a new UploadStream instance.
     *
     * @param {GraphicsDevice} device - The graphics device.
     * @param {boolean} [useSingleBuffer] - If true, uses simple direct uploads (single texture on
     * WebGL, direct write on WebGPU). If false (default), uses optimized multi-buffer strategy (PBOs
     * with orphaning on WebGL, staging buffers on WebGPU) for potentially non-blocking uploads.
     */
    constructor(device, useSingleBuffer = false) {
        this.device = device;
        this.useSingleBuffer = useSingleBuffer;

        // Create platform-specific implementation
        this.impl = device.createUploadStreamImpl(this);
    }

    /**
     * Upload data to a texture (WebGL path) or storage buffer (WebGPU path).
     * For WebGL textures, both offset and size must be multiples of the texture width (aligned to
     * full rows).
     * For WebGPU storage buffers, both offset and size byte values must be multiples of 4.
     *
     * @param {Uint8Array|Uint32Array|Float32Array} data - The data to upload. Must contain at least
     * `size` elements.
     * @param {Texture|StorageBuffer} target - The target resource (texture for WebGL, storage
     * buffer for WebGPU).
     * @param {number} [offset] - The element offset in the target where upload starts. Defaults to 0.
     * For WebGL textures, must be a multiple of texture width. For WebGPU, the byte offset must be
     * a multiple of 4.
     * @param {number} [size] - The number of elements to upload. Defaults to data.length.
     * For WebGL textures, must be a multiple of texture width. For WebGPU, the byte size must be
     * a multiple of 4.
     */
    upload(data, target, offset = 0, size = data.length) {
        this.impl?.upload(data, target, offset, size);
    }

    /**
     * Destroy the upload stream and clean up all pooled resources.
     */
    destroy() {
        this.impl?.destroy();
        this.impl = null;
    }
}

export { UploadStream };
