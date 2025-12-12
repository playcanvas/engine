import { Debug } from '../../core/debug.js';
import { SHADERLANGUAGE_GLSL } from '../../platform/graphics/constants.js';
import { DeviceCache } from '../../platform/graphics/device-cache.js';
import { ShaderChunkMap } from './shader-chunk-map.js';

/**
 * @import { GraphicsDevice } from '../../platform/graphics/graphics-device.js'
 * @import { ChunkValidation } from './shader-chunk-map.js'
 */

const _chunksCache = new DeviceCache();

/**
 * A collection of GLSL and WGSL shader chunks, used to generate shaders.
 *
 * @category Graphics
 */
class ShaderChunks {
    /**
     * Static map of chunk validations shared by all instances.
     *
     * @type {Map<string, ChunkValidation>}
     * @private
     */
    static _validations = new Map();

    /**
     * A map of shader chunks for GLSL.
     *
     * @type {ShaderChunkMap}
     * @ignore
     */
    glsl = new ShaderChunkMap(ShaderChunks._validations);

    /**
     * A map of shader chunks for WGSL.
     *
     * @type {ShaderChunkMap}
     * @ignore
     */
    wgsl = new ShaderChunkMap(ShaderChunks._validations);

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
     * Register a validation for a shader chunk. When the chunk is set, the validation will be
     * executed. This is useful for deprecation warnings or content validation.
     *
     * @param {string} name - The name of the shader chunk.
     * @param {ChunkValidation} options - Validation options.
     * @example
     * // Deprecate an existing chunk - only warn when overridden with non-default code
     * import { myChunksGLSL } from './glsl/collections/my-chunks-glsl.js';
     * import { myChunksWGSL } from './wgsl/collections/my-chunks-wgsl.js';
     *
     * ShaderChunks.registerValidation('myChunkVS', {
     *     message: 'myChunkVS is deprecated. Use newChunkVS instead.',
     *     defaultCodeGLSL: myChunksGLSL.myChunkVS,
     *     defaultCodeWGSL: myChunksWGSL.myChunkVS
     * });
     * @example
     * // Warn for a removed chunk - any attempt to use it triggers warning
     * ShaderChunks.registerValidation('removedChunkVS', {
     *     message: 'removedChunkVS has been removed. Use replacementChunkVS instead.'
     * });
     * @example
     * // Use callback for custom validation logic
     * ShaderChunks.registerValidation('myChunkVS', {
     *     callback: (name, code) => {
     *         if (code.includes('gl_FragColor')) {
     *             Debug.error(`Chunk ${name} uses deprecated gl_FragColor. Use pcFragColor instead.`);
     *         }
     *     }
     * });
     */
    static registerValidation(name, options) {
        Debug.call(() => {
            ShaderChunks._validations.set(name, options);
        });
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
