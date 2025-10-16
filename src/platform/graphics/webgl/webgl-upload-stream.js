import { Debug } from '../../../core/debug.js';

/**
 * @import { UploadStream } from '../upload-stream.js'
 * @import { Texture } from '../texture.js'
 */

/**
 * WebGL implementation of UploadStream.
 * Can use either simple direct texture uploads or optimized PBO strategy with orphaning.
 *
 * @ignore
 */
class WebglUploadStream {
    /**
     * Available PBOs ready for immediate use.
     *
     * @type {Array<{pbo: WebGLBuffer, size: number}>}
     */
    availablePBOs = [];

    /**
     * PBOs currently in use by the GPU.
     *
     * @type {Array<{pbo: WebGLBuffer, size: number, sync: WebGLSync}>}
     */
    pendingPBOs = [];

    /**
     * @param {UploadStream} uploadStream - The upload stream.
     */
    constructor(uploadStream) {
        this.uploadStream = uploadStream;
        this.useSingleBuffer = uploadStream.useSingleBuffer;
    }

    destroy() {
        // @ts-ignore - gl is available on WebglGraphicsDevice
        const gl = this.uploadStream.device.gl;
        this.availablePBOs.forEach(info => gl.deleteBuffer(info.pbo));
        this.pendingPBOs.forEach((item) => {
            if (item.sync) gl.deleteSync(item.sync);
            gl.deleteBuffer(item.pbo);
        });
    }

    /**
     * Update PBOs: poll completed ones and remove undersized buffers.
     *
     * @param {number} minByteSize - Minimum size for buffers to keep. Smaller buffers are destroyed.
     */
    update(minByteSize) {
        // @ts-ignore - gl is available on WebglGraphicsDevice
        const gl = this.uploadStream.device.gl;

        // Poll pending PBOs
        const pending = this.pendingPBOs;
        for (let i = pending.length - 1; i >= 0; i--) {
            const item = pending[i];

            const result = gl.clientWaitSync(item.sync, 0, 0);
            if (result === gl.CONDITION_SATISFIED || result === gl.ALREADY_SIGNALED) {
                gl.deleteSync(item.sync);
                this.availablePBOs.push({ pbo: item.pbo, size: item.size });
                pending.splice(i, 1);
            }
        }

        // Remove any available PBOs that are too small
        const available = this.availablePBOs;
        for (let i = available.length - 1; i >= 0; i--) {
            if (available[i].size < minByteSize) {
                gl.deleteBuffer(available[i].pbo);
                available.splice(i, 1);
            }
        }
    }

    /**
     * Upload data to a texture using PBOs (optimized) or direct upload (simple).
     *
     * @param {Uint8Array|Uint32Array|Float32Array} data - The data to upload.
     * @param {Texture} target - The target texture.
     * @param {number} offset - The element offset in the target. Must be a multiple of texture width.
     * @param {number} size - The number of elements to upload. Must be a multiple of texture width.
     */
    upload(data, target, offset, size) {
        if (this.useSingleBuffer) {
            this.uploadDirect(data, target, offset, size);
        } else {
            this.uploadPBO(data, target, offset, size);
        }
    }

    /**
     * Direct texture upload (simple, blocking).
     *
     * @param {Uint8Array|Uint32Array|Float32Array} data - The data to upload.
     * @param {Texture} target - The target texture.
     * @param {number} offset - The element offset in the target.
     * @param {number} size - The number of elements to upload.
     * @private
     */
    uploadDirect(data, target, offset, size) {
        Debug.assert(offset === 0, 'Direct texture upload with non-zero offset is not supported. Use PBO mode instead.');
        Debug.assert(target._levels);

        target._levels[0] = data;
        target.upload();
    }

    /**
     * PBO-based upload with orphaning (optimized, potentially non-blocking).
     *
     * @param {Uint8Array|Uint32Array|Float32Array} data - The data to upload.
     * @param {import('../texture.js').Texture} target - The target texture.
     * @param {number} offset - The element offset in the target.
     * @param {number} size - The number of elements to upload.
     * @private
     */
    uploadPBO(data, target, offset, size) {
        const device = this.uploadStream.device;
        // @ts-ignore - gl is available on WebglGraphicsDevice
        const gl = device.gl;

        const width = target.width;
        const byteSize = size * data.BYTES_PER_ELEMENT;

        // Update PBOs
        this.update(byteSize);

        // WebGL requires offset and size aligned to full rows for texSubImage2D
        Debug.assert(offset % width === 0, `Upload offset (${offset}) must be a multiple of texture width (${width}) for row alignment`);
        Debug.assert(size % width === 0, `Upload size (${size}) must be a multiple of texture width (${width}) for row alignment`);

        const startY = offset / width;
        const height = size / width;

        // Get or create a PBO (guaranteed to be large enough after update)
        const pboInfo = this.availablePBOs.pop() ?? (() => {
            const pbo = gl.createBuffer();
            return { pbo, size: byteSize };
        })();

        // Orphan + bufferSubData pattern
        gl.bindBuffer(gl.PIXEL_UNPACK_BUFFER, pboInfo.pbo);
        gl.bufferData(gl.PIXEL_UNPACK_BUFFER, byteSize, gl.STREAM_DRAW);
        gl.bufferSubData(gl.PIXEL_UNPACK_BUFFER, 0, new Uint8Array(data.buffer, data.byteOffset, byteSize));

        // Unbind PBO before setTexture
        gl.bindBuffer(gl.PIXEL_UNPACK_BUFFER, null);

        // Ensure texture is created and bound
        // @ts-ignore - setTexture is available on WebglGraphicsDevice
        device.setTexture(target, 0);

        // Rebind PBO for texSubImage2D
        gl.bindBuffer(gl.PIXEL_UNPACK_BUFFER, pboInfo.pbo);

        // Set pixel-store parameters (use device methods for cached state)
        device.setUnpackFlipY(false);
        device.setUnpackPremultiplyAlpha(false);
        gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
        gl.pixelStorei(gl.UNPACK_ROW_LENGTH, 0);
        gl.pixelStorei(gl.UNPACK_SKIP_ROWS, 0);
        gl.pixelStorei(gl.UNPACK_SKIP_PIXELS, 0);

        // Copy from PBO to texture (GPU-side)
        const impl = target.impl;
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, startY, width, height, impl._glFormat, impl._glPixelType, 0);

        gl.bindBuffer(gl.PIXEL_UNPACK_BUFFER, null);

        // Track for recycling
        const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
        this.pendingPBOs.push({ pbo: pboInfo.pbo, size: byteSize, sync });

        gl.flush();
    }
}

export { WebglUploadStream };
