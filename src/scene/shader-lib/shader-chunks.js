import { SHADERLANGUAGE_GLSL } from '../../platform/graphics/constants.js';
import { DeviceCache } from '../../platform/graphics/device-cache.js';
import { ShaderChunkMap } from './shader-chunk-map.js';

/**
 * @import { GraphicsDevice } from '../../platform/graphics/graphics-device.js'
 */

const _chunksCache = new DeviceCache();

/**
 * A collection of GLSL and WGSL shader chunks, used to generate shaders.
 *
 * @category Graphics
 */
class ShaderChunks {
    /**
     * A map of shader chunks for GLSL.
     *
     * @type {ShaderChunkMap}
     * @ignore
     */
    glsl = new ShaderChunkMap();

    /**
     * A map of shader chunks for WGSL.
     *
     * @type {ShaderChunkMap}
     * @ignore
     */
    wgsl = new ShaderChunkMap();

    /**
     * Returns a shader chunks map for the given device and shader language.
     *
     * @param {GraphicsDevice} device - The graphics device.
     * @param {string} shaderLanguage - The shader language to use (GLSL or WGSL).
     * @returns {ShaderChunkMap} The shader chunks for the specified language.
     */
    static get(device, shaderLanguage = SHADERLANGUAGE_GLSL) {
        const cache = _chunksCache.get(device, () => {
            return new ShaderChunks();
        });
        return shaderLanguage === SHADERLANGUAGE_GLSL ? cache.glsl : cache.wgsl;
    }

    /**
     * Specifies the API version of the shader chunks.
     *
     * This should be a string containing the current engine major and minor version (e.g., '2.8'
     * for engine v2.8.1) and ensures compatibility with the current engine version. When providing
     * custom shader chunks, set this to the latest supported version. If a future engine release no
     * longer supports the specified version, a warning will be issued. In that case, update your
     * shader chunks to match the new format and set this to the latest version accordingly.
     *
     * @type {string}
     */
    version = '';

    get useWGSL() {
        // if we have no glsl overrides, or have wgsl overrides, wgsl is used on WebGPU
        return this.glsl.size === 0 || this.wgsl.size > 0;
    }

    get key() {
        return `GLSL:${this.glsl.key}|WGSL:${this.wgsl.key}|API:${this.version}`;
    }

    isDirty() {
        return this.glsl.isDirty() || this.wgsl.isDirty();
    }

    resetDirty() {
        this.glsl.resetDirty();
        this.wgsl.resetDirty();
    }

    /**
     * Copy the shader chunks.
     *
     * @param {ShaderChunks} source - The instance to copy.
     * @returns {ShaderChunks} The destination instance.
     * @ignore
     */
    copy(source) {
        this.version = source.version;
        this.glsl.copy(source.glsl);
        this.wgsl.copy(source.wgsl);

        return this;
    }
}

export { ShaderChunks };
