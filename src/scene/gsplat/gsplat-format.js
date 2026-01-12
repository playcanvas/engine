import { getGlslShaderType, getWgslShaderType } from '../../platform/graphics/constants.js';

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
     * User-provided GLSL code for reading splat data.
     *
     * @type {string}
     * @private
     */
    _readGLSL;

    /**
     * User-provided WGSL code for reading splat data.
     *
     * @type {string}
     * @private
     */
    _readWGSL;

    /**
     * User-provided additional GLSL declarations (e.g. custom uniforms).
     *
     * @type {string}
     * @private
     */
    _userDeclarationsGLSL;

    /**
     * User-provided additional WGSL declarations (e.g. custom uniforms).
     *
     * @type {string}
     * @private
     */
    _userDeclarationsWGSL;

    /**
     * Cached GLSL declarations.
     *
     * @type {string|null}
     * @private
     */
    _declarationsGLSL = null;

    /**
     * Cached WGSL declarations.
     *
     * @type {string|null}
     * @private
     */
    _declarationsWGSL = null;

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

        this._readGLSL = options.readGLSL ?? '';
        this._readWGSL = options.readWGSL ?? '';
        this._userDeclarationsGLSL = options.declarationsGLSL ?? '';
        this._userDeclarationsWGSL = options.declarationsWGSL ?? '';
    }

    /**
     * Generates GLSL declarations (texture uniforms + read functions).
     *
     * @returns {string} GLSL shader code for declarations.
     * @ignore
     */
    getDeclarationsGLSL() {
        if (this._declarationsGLSL === null) {
            const lines = ['uniform uint splatTextureSize;\nivec2 splatUV;\n'];

            // Add user-provided declarations (e.g. custom uniforms)
            if (this._userDeclarationsGLSL) {
                lines.push(`${this._userDeclarationsGLSL}\n`);
            }

            // Generate texture uniforms
            for (const stream of this.streams) {
                const info = getGlslShaderType(stream.format);
                lines.push(`uniform highp ${info.sampler} ${stream.name};`);
            }

            // Generate load functions
            for (const stream of this.streams) {
                const info = getGlslShaderType(stream.format);
                lines.push(`${info.returnType} load${stream.name}() { return texelFetch(${stream.name}, splatUV, 0); }`);
            }

            this._declarationsGLSL = lines.join('\n');
        }
        return this._declarationsGLSL;
    }

    /**
     * Generates WGSL declarations (texture uniforms + read functions).
     *
     * @returns {string} WGSL shader code for declarations.
     * @ignore
     */
    getDeclarationsWGSL() {
        if (this._declarationsWGSL === null) {
            const lines = ['uniform splatTextureSize: u32;\nvar<private> splatUV: vec2i;\n'];

            // Add user-provided declarations (e.g. custom uniforms)
            if (this._userDeclarationsWGSL) {
                lines.push(`${this._userDeclarationsWGSL}\n`);
            }

            // Generate texture uniforms
            for (const stream of this.streams) {
                const info = getWgslShaderType(stream.format);
                lines.push(`var ${stream.name}: ${info.textureType};`);
            }

            // Generate load functions
            for (const stream of this.streams) {
                const info = getWgslShaderType(stream.format);
                lines.push(`fn load${stream.name}() -> ${info.returnType} { return textureLoad(${stream.name}, splatUV, 0); }`);
            }

            this._declarationsWGSL = lines.join('\n');
        }
        return this._declarationsWGSL;
    }

    /**
     * Returns declarations for the appropriate shader language based on device.
     *
     * @returns {string} Shader code for declarations.
     * @ignore
     */
    getDeclarations() {
        return this._device.isWebGPU ? this.getDeclarationsWGSL() : this.getDeclarationsGLSL();
    }

    /**
     * Returns the GLSL read code (user's readGLSL).
     *
     * @returns {string} GLSL code that reads streams and sets splat attributes.
     * @ignore
     */
    getReadCodeGLSL() {
        return this._readGLSL;
    }

    /**
     * Returns the WGSL read code (user's readWGSL).
     *
     * @returns {string} WGSL code that reads streams and sets splat attributes.
     * @ignore
     */
    getReadCodeWGSL() {
        return this._readWGSL;
    }

    /**
     * Returns read code for the appropriate shader language based on device.
     *
     * @returns {string} Shader code for reading splat data.
     * @ignore
     */
    getReadCode() {
        return this._device.isWebGPU ? this.getReadCodeWGSL() : this.getReadCodeGLSL();
    }
}

export { GSplatFormat };
