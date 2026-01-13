import { getGlslShaderType, getWgslShaderType } from '../../platform/graphics/constants.js';
import { hashCode } from '../../core/hash.js';

/**
 * @import { GraphicsDevice } from '../../platform/graphics/graphics-device.js'
 */

/**
 * @typedef {object} GSplatStreamDescriptor
 * @property {string} name - The name of the stream (used as texture uniform name).
 * @property {number} format - The pixel format of the texture (e.g. PIXELFORMAT_RGBA32F).
 */

/**
 * Describes the texture layout for procedural splat data.
 *
 * @category Graphics
 */
class GSplatFormat {
    /**
     * @type {GraphicsDevice}
     * @private
     */
    _device;

    /**
     * Array of stream descriptors (deep copy).
     *
     * @type {GSplatStreamDescriptor[]}
     * @readonly
     */
    streams;

    /**
     * User-provided code for reading splat data (GLSL or WGSL based on device).
     *
     * @type {string}
     * @private
     */
    _read;

    /**
     * User-provided additional declarations (GLSL or WGSL based on device).
     *
     * @type {string}
     * @private
     */
    _declarations;

    /**
     * Cached declarations (generated + user-provided).
     *
     * @type {string|null}
     * @private
     */
    _cachedDeclarations = null;

    /**
     * Cached hash value.
     *
     * @type {number|undefined}
     * @private
     */
    _hash;

    /**
     * Returns a hash of this format's configuration. Used for shader caching.
     * Computed from raw inputs to avoid generating shader code just for the hash.
     *
     * @type {number}
     * @ignore
     */
    get hash() {
        if (this._hash === undefined) {
            const streamsStr = this.streams.map(s => `${s.name}:${s.format}`).join(',');
            this._hash = hashCode(
                streamsStr +
                this._read +
                this._declarations
            );
        }
        return this._hash;
    }

    /**
     * Creates a new GSplatFormat instance.
     *
     * @param {GraphicsDevice} device - The graphics device.
     * @param {GSplatStreamDescriptor[]} streams - Array of stream descriptors.
     * @param {object} [options] - Optional parameters.
     * @param {string} [options.readGLSL] - GLSL code that reads streams and sets splat
     * attributes (splatCenter, splatColor, splatScale, splatRotation).
     * @param {string} [options.readWGSL] - WGSL code that reads streams and sets splat
     * attributes (splatCenter, splatColor, splatScale, splatRotation).
     * @param {string} [options.declarationsGLSL] - Additional GLSL declarations (e.g. custom uniforms).
     * @param {string} [options.declarationsWGSL] - Additional WGSL declarations (e.g. custom uniforms).
     */
    constructor(device, streams, options = {}) {
        this._device = device;

        // Deep copy streams
        this.streams = streams.map(s => ({ name: s.name, format: s.format }));

        // Pick the appropriate shader language based on device
        const isWebGPU = device.isWebGPU;
        this._read = isWebGPU ? (options.readWGSL ?? '') : (options.readGLSL ?? '');
        this._declarations = isWebGPU ? (options.declarationsWGSL ?? '') : (options.declarationsGLSL ?? '');
    }

    /**
     * Generates declarations (texture uniforms + load functions).
     *
     * @returns {string} Shader code for declarations.
     * @ignore
     */
    getDeclarations() {
        if (this._cachedDeclarations === null) {
            const isWebGPU = this._device.isWebGPU;
            const lines = [];

            // Add user-provided declarations (e.g. custom uniforms)
            if (this._declarations) {
                lines.push(`${this._declarations}\n`);
            }

            if (isWebGPU) {
                // WGSL: Generate texture uniforms and load functions
                for (const stream of this.streams) {
                    const info = getWgslShaderType(stream.format);
                    lines.push(`var ${stream.name}: ${info.textureType};`);
                }

                for (const stream of this.streams) {
                    const info = getWgslShaderType(stream.format);
                    const funcName = stream.name.charAt(0).toUpperCase() + stream.name.slice(1);
                    lines.push(`fn load${funcName}() -> ${info.returnType} { return textureLoad(${stream.name}, splatUV, 0); }`);
                }
            } else {
                // GLSL: Generate texture uniforms and load functions
                for (const stream of this.streams) {
                    const info = getGlslShaderType(stream.format);
                    lines.push(`uniform highp ${info.sampler} ${stream.name};`);
                }

                for (const stream of this.streams) {
                    const info = getGlslShaderType(stream.format);
                    const funcName = stream.name.charAt(0).toUpperCase() + stream.name.slice(1);
                    lines.push(`${info.returnType} load${funcName}() { return texelFetch(${stream.name}, splatUV, 0); }`);
                }
            }

            this._cachedDeclarations = lines.join('\n');
        }
        return this._cachedDeclarations;
    }

    /**
     * Returns the read code.
     *
     * @returns {string} Shader code for reading splat data.
     * @ignore
     */
    getReadCode() {
        return this._read;
    }
}

export { GSplatFormat };
