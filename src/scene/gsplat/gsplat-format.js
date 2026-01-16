import { getGlslShaderType, getWgslShaderType } from '../../platform/graphics/constants.js';
import { hashCode } from '../../core/hash.js';
import { Debug } from '../../core/debug.js';

/**
 * @import { GraphicsDevice } from '../../platform/graphics/graphics-device.js'
 */

/**
 * @typedef {object} GSplatStreamDescriptor
 * @property {string} name - The name of the stream (used as texture uniform name).
 * @property {number} format - The pixel format of the texture (e.g. PIXELFORMAT_RGBA32F).
 * @property {boolean} [instance] - If true, texture is per gsplat component instance. Default: false.
 */

/**
 * Serializes an array of stream descriptors to a string for hashing.
 *
 * @param {GSplatStreamDescriptor[]} streams - Array of stream descriptors.
 * @returns {string} Serialized string.
 */
const serializeStreams = streams => streams.map(s => `${s.name}:${s.format}:${s.instance}`).join(',');

/**
 * Gsplat resources store per-splat data (positions, colors, rotations, scales, spherical
 * harmonics) in GPU textures. This class describes those texture streams and generates the
 * shader code needed to access them.
 *
 * Each stream defines a texture with a name and pixel format. The class automatically generates
 * shader declarations (uniforms/samplers) and load functions (e.g. `loadColor()`) for each
 * stream. A read shader can be provided to define how splat attributes are extracted from
 * these textures.
 *
 * Users can add extra streams via {@link addExtraStreams} for custom per-splat data. These
 * can be per-resource (shared across instances) or per-instance (unique to each gsplat
 * component).
 *
 * For loaded gsplat resources, base streams are automatically configured based on the loaded
 * data format. For {@link GSplatContainer}, users define both base and extra streams to
 * specify the complete data layout.
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
     * Extra streams added via addExtraStreams(). Streams can only be added, never removed.
     * This restriction exists because:
     * - GSplatInfo captures references to instance textures as snapshots
     * - If textures were destroyed on removal, snapshots would have dangling references
     *
     * @type {GSplatStreamDescriptor[]}
     * @private
     */
    _extraStreams = [];

    /**
     * Set of all stream names (base + extra) for fast duplicate checking.
     *
     * @type {Set<string>}
     * @private
     */
    _streamNames = new Set();

    /**
     * Version counter that increments when extra streams change.
     *
     * @type {number}
     * @private
     */
    _extraStreamsVersion = 0;

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
     * Cached resource streams array.
     *
     * @type {GSplatStreamDescriptor[]|null}
     * @private
     */
    _resourceStreams = null;

    /**
     * Cached instance streams array.
     *
     * @type {GSplatStreamDescriptor[]|null}
     * @private
     */
    _instanceStreams = null;

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
        this.streams = streams.map(s => ({ name: s.name, format: s.format, instance: s.instance ?? false }));

        // Initialize stream names set for duplicate checking
        this._streamNames = new Set(this.streams.map(s => s.name));

        // Pick the appropriate shader language based on device
        const isWebGPU = device.isWebGPU;
        this._read = isWebGPU ? (options.readWGSL ?? '') : (options.readGLSL ?? '');
        this._declarations = isWebGPU ? (options.declarationsWGSL ?? '') : (options.declarationsGLSL ?? '');
    }

    /**
     * Returns a hash of this format's configuration. Used for shader caching.
     * Computed from raw inputs to avoid generating shader code just for the hash.
     *
     * @type {number}
     * @ignore
     */
    get hash() {
        if (this._hash === undefined) {
            const streamsStr = serializeStreams(this.streams);
            const extraStr = serializeStreams(this._extraStreams);
            this._hash = hashCode(
                streamsStr +
                extraStr +
                this._read +
                this._declarations
            );
        }
        return this._hash;
    }

    /**
     * Returns the version counter. Increments when extra streams change.
     *
     * @type {number}
     * @ignore
     */
    get extraStreamsVersion() {
        return this._extraStreamsVersion;
    }

    /**
     * Gets the extra streams array. Streams can only be added via {@link addExtraStreams},
     * not removed. Do not modify the returned array directly.
     *
     * @type {GSplatStreamDescriptor[]}
     */
    get extraStreams() {
        return this._extraStreams;
    }

    /**
     * Returns all resource-level streams (base streams + extra streams where instance !== true).
     * Used by GSplatStreams for resource texture management.
     *
     * @type {GSplatStreamDescriptor[]}
     * @ignore
     */
    get resourceStreams() {
        if (this._resourceStreams === null) {
            // Base streams + extra streams that are not instance-level
            this._resourceStreams = [
                ...this.streams.filter(s => !s.instance),
                ...this._extraStreams.filter(s => !s.instance)
            ];
        }
        return this._resourceStreams;
    }

    /**
     * Returns all instance-level streams (extra streams where instance === true).
     * Used by GSplatStreams for per-component-instance texture management.
     *
     * @type {GSplatStreamDescriptor[]}
     * @ignore
     */
    get instanceStreams() {
        if (this._instanceStreams === null) {
            this._instanceStreams = this._extraStreams.filter(s => s.instance);
        }
        return this._instanceStreams;
    }

    /**
     * Adds additional texture streams for custom gsplat data. Each stream defines a texture
     * that can store extra information, accessible in shaders via generated load functions.
     * Streams with `instance: true` are created per gsplat component instance, while others
     * are shared across all instances of the same resource.
     *
     * Note: Streams cannot be removed once added currently.
     *
     * @param {GSplatStreamDescriptor[]} streams - Array of stream descriptors to add.
     */
    addExtraStreams(streams) {
        if (!streams || streams.length === 0) return;

        let added = false;
        for (const s of streams) {
            if (this._streamNames.has(s.name)) {
                Debug.error(`GSplatFormat: Stream '${s.name}' already exists, ignoring.`);
                continue;
            }

            // Add with instance default
            this._extraStreams.push({
                name: s.name,
                format: s.format,
                instance: s.instance ?? false
            });
            this._streamNames.add(s.name);
            added = true;
        }

        if (added) {
            this._extraStreamsVersion++;
            this._invalidateCaches();
        }
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

            // Get all streams (base + extra) - shader declares all regardless of instance flag
            const allStreams = [...this.streams, ...this._extraStreams];

            if (isWebGPU) {
                // WGSL: Generate texture uniforms and load functions
                for (const stream of allStreams) {
                    const info = getWgslShaderType(stream.format);
                    lines.push(`var ${stream.name}: ${info.textureType};`);
                }

                for (const stream of allStreams) {
                    const info = getWgslShaderType(stream.format);
                    const funcName = stream.name.charAt(0).toUpperCase() + stream.name.slice(1);
                    lines.push(`fn load${funcName}() -> ${info.returnType} { return textureLoad(${stream.name}, splatUV, 0); }`);
                }
            } else {
                // GLSL: Generate texture uniforms and load functions
                for (const stream of allStreams) {
                    const info = getGlslShaderType(stream.format);
                    lines.push(`uniform highp ${info.sampler} ${stream.name};`);
                }

                for (const stream of allStreams) {
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

    /**
     * Invalidates all cached values when streams change.
     *
     * @private
     */
    _invalidateCaches() {
        this._hash = undefined;
        this._cachedDeclarations = null;
        this._resourceStreams = null;
        this._instanceStreams = null;
    }
}

export { GSplatFormat };
