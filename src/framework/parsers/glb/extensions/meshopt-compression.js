import { isMeshoptConfigured, meshoptDecode } from '../../meshopt-decoder.js';

// https://github.com/KhronosGroup/glTF/tree/main/extensions/2.0/Khronos/KHR_meshopt_compression
// https://github.com/KhronosGroup/glTF/tree/main/extensions/2.0/Vendor/EXT_meshopt_compression
// The two extensions share their JSON schema. KHR adds the v1 vertex bitstream and the COLOR
// filter, both of which the decoder handles, so the parser treats them the same.

/**
 * Returns the meshopt compression extension of a glTF buffer or buffer view.
 *
 * @param {object} gltfObject - The glTF buffer or buffer view.
 * @returns {object|undefined} The extension object, if present.
 */
const getMeshoptCompression = (gltfObject) => {
    const extensions = gltfObject.extensions;
    return extensions?.KHR_meshopt_compression ?? extensions?.EXT_meshopt_compression;
};

/**
 * Returns whether a buffer holding only uncompressed fallback data for meshopt compressed buffer
 * views should not be loaded. A fallback buffer without a uri holds no data, unless it is the
 * binary chunk of a glb, and one with a uri is not downloaded when a decoder is available.
 *
 * @param {object} gltfBuffer - The glTF buffer.
 * @param {number} index - The index of the buffer.
 * @returns {boolean} True if the buffer should resolve to no data.
 */
const skipMeshoptFallbackBuffer = (gltfBuffer, index) => {
    if (getMeshoptCompression(gltfBuffer)?.fallback !== true) {
        return false;
    }
    return gltfBuffer.hasOwnProperty('uri') ? isMeshoptConfigured() : index > 0;
};

/**
 * Decodes a buffer view compressed with meshopt.
 *
 * @param {object} gltfBufferView - The glTF buffer view.
 * @param {Promise<Uint8Array|null>[]} buffers - The loaded glTF buffers.
 * @returns {Promise<Uint8Array>|null} The decoded data, or null if the buffer view is not
 * compressed, or no decoder is available so its fallback data must be used.
 */
const decodeMeshoptBufferView = (gltfBufferView, buffers) => {
    const compression = getMeshoptCompression(gltfBufferView);
    if (!compression || !isMeshoptConfigured()) {
        return null;
    }

    const { byteOffset = 0, byteLength, byteStride, count, mode, filter = 'NONE' } = compression;

    return buffers[compression.buffer].then((buffer) => {
        const source = new Uint8Array(buffer.buffer, buffer.byteOffset + byteOffset, byteLength);
        return meshoptDecode(source, count, byteStride, mode, filter);
    });
};

export { getMeshoptCompression, skipMeshoptFallbackBuffer, decodeMeshoptBufferView };
