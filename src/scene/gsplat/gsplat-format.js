import {
    getGlslShaderType, getWgslShaderType,
    PIXELFORMAT_RGBA16F, PIXELFORMAT_RGBA32F
} from '../../platform/graphics/constants.js';
import { hashCode } from '../../core/hash.js';
import { Debug } from '../../core/debug.js';
import { GSPLAT_STREAM_RESOURCE, GSPLAT_STREAM_INSTANCE } from '../constants.js';

// Shader chunk templates for stream declarations
import glslStreamDecl from '../shader-lib/glsl/chunks/gsplat/vert/gsplatStreamDecl.js';
import wgslStreamDecl from '../shader-lib/wgsl/chunks/gsplat/vert/gsplatStreamDecl.js';
import glslStreamOutput from '../shader-lib/glsl/chunks/gsplat/vert/gsplatStreamOutput.js';
import wgslStreamOutput from '../shader-lib/wgsl/chunks/gsplat/vert/gsplatStreamOutput.js';

// Container format read chunks
import glslContainerFloatRead from '../shader-lib/glsl/chunks/gsplat/vert/formats/containerFloatRead.js';
import wgslContainerFloatRead from '../shader-lib/wgsl/chunks/gsplat/vert/formats/containerFloatRead.js';

/**
 * @import { GraphicsDevice } from '../../platform/graphics/graphics-device.js'
 */

/**
 * @typedef {object} GSplatStreamDescriptor
 * @property {string} name - The name of the stream (used as texture uniform name).
 * @property {number} format - The pixel format of the texture (e.g. PIXELFORMAT_RGBA32F).
 * When used as an extra stream for work buffers or as a destination stream for
 * GSplatProcessor, the format must be renderable as these textures are used as render
 * targets. Ensure the format is renderable on all target devices. See {@link Texture} for
 * details on renderable formats and device capabilities.
 * @property {number} [storage] - Storage type: GSPLAT_STREAM_RESOURCE (default, shared across
 * instances) or GSPLAT_STREAM_INSTANCE (per-component instance). Note: Work buffer formats
 * (accessed via `app.scene.gsplat.format`) do not support GSPLAT_STREAM_INSTANCE.
 */

/**
 * Serializes an array of stream descriptors to a string for hashing.
 *
 * @param {GSplatStreamDescriptor[]} streams - Array of stream descriptors.
 * @returns {string} Serialized string.
 */
const serializeStreams = streams => streams.map(s => `${s.name}:${s.format}:${s.storage}`).join(',');

// Pre-compiled regex patterns for template replacement
const RE_NAME = /\{name\}/g;
const RE_SAMPLER = /\{sampler\}/g;
const RE_TEXTURE_TYPE = /\{textureType\}/g;
const RE_RETURN_TYPE = /\{returnType\}/g;
const RE_FUNC_NAME = /\{funcName\}/g;
const RE_INDEX = /\{index\}/g;
const RE_COLOR_SLOT = /\{colorSlot\}/g;
const RE_DEFINE_GUARD = /\{defineGuard\}/g;

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
     * Array of stream descriptors.
     *
     * @type {GSplatStreamDescriptor[]}
     * @readonly
     */
    streams;

    /**
     * User-provided code for reading splat data (GLSL or WGSL based on device).
     * Must define getCenter(), getColor(), getRotation(), getScale() functions.
     *
     * @type {string}
     * @private
     */
    _read;

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
     * @param {object} options - Format options.
     * @param {string} [options.readGLSL] - GLSL code defining getCenter(), getColor(),
     * getRotation(), getScale() functions. Can include additional declarations at module scope.
     * Required for WebGL.
     * @param {string} [options.readWGSL] - WGSL code defining getCenter(), getColor(),
     * getRotation(), getScale() functions. Can include additional declarations at module scope.
     * Required for WebGPU.
     */
    constructor(device, streams, options) {
        this._device = device;

        // Shallow copy streams array
        this.streams = [...streams];

        // Initialize stream names set for duplicate checking
        this._streamNames = new Set(this.streams.map(s => s.name));

        // Pick the appropriate shader language based on device
        const isWebGPU = device.isWebGPU;
        this._read = isWebGPU ? options.readWGSL : options.readGLSL;

        // Validate read code is provided for the current device
        Debug.assert(this._read, `GSplatFormat: ${isWebGPU ? 'readWGSL' : 'readGLSL'} is required`);
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
                this._read
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
                ...this.streams.filter(s => s.storage !== GSPLAT_STREAM_INSTANCE),
                ...this._extraStreams.filter(s => s.storage !== GSPLAT_STREAM_INSTANCE)
            ];
        }
        return this._resourceStreams;
    }

    /**
     * Returns all instance-level streams (extra streams with GSPLAT_STREAM_INSTANCE storage).
     * Used by GSplatStreams for per-component-instance texture management.
     *
     * @type {GSplatStreamDescriptor[]}
     * @ignore
     */
    get instanceStreams() {
        if (this._instanceStreams === null) {
            this._instanceStreams = this._extraStreams.filter(s => s.storage === GSPLAT_STREAM_INSTANCE);
        }
        return this._instanceStreams;
    }

    /**
     * Adds additional texture streams for custom gsplat data. Each stream defines a texture
     * that can store extra information, accessible in shaders via generated load functions.
     * Streams with `storage: GSPLAT_STREAM_INSTANCE` are created per gsplat component instance,
     * while others are shared across all instances of the same resource.
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

            // Add with storage default
            this._extraStreams.push({
                name: s.name,
                format: s.format,
                storage: s.storage ?? GSPLAT_STREAM_RESOURCE
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
     * Generates input declarations (texture uniforms + load functions).
     *
     * @param {string[]} [streamNames] - Optional array of stream names to filter. If not provided,
     * generates declarations for all streams.
     * @returns {string} Shader code for declarations.
     * @ignore
     */
    getInputDeclarations(streamNames) {
        const isWebGPU = this._device.isWebGPU;
        const template = isWebGPU ? wgslStreamDecl : glslStreamDecl;
        const getShaderType = isWebGPU ? getWgslShaderType : getGlslShaderType;
        const lines = [];

        // Get streams - filter if names specified
        let streams = [...this.streams, ...this._extraStreams];
        if (streamNames) {
            streams = streams.filter(s => streamNames.includes(s.name));
        }

        for (const stream of streams) {
            const info = getShaderType(stream.format);
            const funcName = stream.name.charAt(0).toUpperCase() + stream.name.slice(1);
            const decl = template
            .replace(RE_NAME, stream.name)
            .replace(RE_SAMPLER, info.sampler ?? '')
            .replace(RE_TEXTURE_TYPE, info.textureType ?? '')
            .replace(RE_RETURN_TYPE, info.returnType)
            .replace(RE_FUNC_NAME, funcName);
            lines.push(decl);
        }

        return lines.join('\n');
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
     * Generates output declarations (write functions) for MRT output streams.
     * Used by GSplatProcessor to generate output functions for dstStreams.
     * Each stream maps to an MRT slot (pcFragColor0, pcFragColor1, etc. in GLSL or
     * processOutput.color, processOutput.color1, etc. in WGSL).
     *
     * @param {GSplatStreamDescriptor[]} outputStreams - Stream descriptors for output.
     * @returns {string} Shader code for output write functions.
     * @ignore
     */
    getOutputDeclarations(outputStreams) {
        const isWebGPU = this._device.isWebGPU;
        const lines = [];

        // Generate output declarations using chunk template
        const template = isWebGPU ? wgslStreamOutput : glslStreamOutput;
        const getShaderType = isWebGPU ? getWgslShaderType : getGlslShaderType;

        for (let i = 0; i < outputStreams.length; i++) {
            const stream = outputStreams[i];
            const info = getShaderType(stream.format);
            const funcName = stream.name.charAt(0).toUpperCase() + stream.name.slice(1);
            const colorSlot = i === 0 ? 'color' : `color${i}`;
            const decl = template
            .replace(RE_FUNC_NAME, funcName)
            .replace(RE_RETURN_TYPE, info.returnType)
            .replace(RE_INDEX, String(i))
            .replace(RE_COLOR_SLOT, colorSlot)
            .replace(RE_DEFINE_GUARD, '1');
            lines.push(decl);
        }

        return lines.join('\n');
    }

    /**
     * Generates no-op stub functions for streams that aren't render targets.
     * Used in color-only mode so user modifier code compiles but writes are ignored.
     *
     * @param {GSplatStreamDescriptor[]} streams - Stream descriptors to generate stubs for.
     * @returns {string} Shader code for no-op write functions.
     * @ignore
     */
    getOutputStubs(streams) {
        const isWebGPU = this._device.isWebGPU;
        const lines = [];
        const template = isWebGPU ? wgslStreamOutput : glslStreamOutput;
        const getShaderType = isWebGPU ? getWgslShaderType : getGlslShaderType;

        for (const stream of streams) {
            const info = getShaderType(stream.format);
            const funcName = stream.name.charAt(0).toUpperCase() + stream.name.slice(1);
            const stub = template
            .replace(RE_FUNC_NAME, funcName)
            .replace(RE_RETURN_TYPE, info.returnType)
            .replace(RE_DEFINE_GUARD, '0');
            lines.push(stub);
        }

        return lines.join('\n');
    }

    /**
     * Returns a stream descriptor by name.
     *
     * @param {string} name - The name of the stream to find.
     * @returns {GSplatStreamDescriptor|undefined} The stream descriptor, or undefined if not found.
     * @ignore
     */
    getStream(name) {
        // Check base streams first
        let stream = this.streams.find(s => s.name === name);
        if (!stream) {
            // Check extra streams
            stream = this._extraStreams.find(s => s.name === name);
        }
        return stream;
    }

    /**
     * Invalidates all cached values when streams change.
     *
     * @private
     */
    _invalidateCaches() {
        this._hash = undefined;
        this._resourceStreams = null;
        this._instanceStreams = null;
    }

    /**
     * Creates a default format using 32F/16F textures, simple to use for CPU data population.
     * This format can be rendered to by {@link GSplatProcessor} when supported. Check
     * {@link GraphicsDevice#textureFloatRenderable} (for RGBA32F) and
     * {@link GraphicsDevice#textureHalfFloatRenderable} (for RGBA16F).
     *
     * The format stores:
     * - `dataColor` (RGBA16F): color.rgba as half floats
     * - `dataCenter` (RGBA32F): center.xyz as floats (w unused)
     * - `dataScale` (RGBA16F): scale.xyz as half floats (w unused)
     * - `dataRotation` (RGBA16F): rotation.xyzw as half floats (w stored directly, not derived)
     *
     * @param {GraphicsDevice} device - The graphics device.
     * @returns {GSplatFormat} The default format.
     */
    static createDefaultFormat(device) {
        return new GSplatFormat(device, [
            { name: 'dataColor', format: PIXELFORMAT_RGBA16F },
            { name: 'dataCenter', format: PIXELFORMAT_RGBA32F },
            { name: 'dataScale', format: PIXELFORMAT_RGBA16F },
            { name: 'dataRotation', format: PIXELFORMAT_RGBA16F }
        ], {
            readGLSL: glslContainerFloatRead,
            readWGSL: wgslContainerFloatRead
        });
    }
}

export { GSplatFormat };
