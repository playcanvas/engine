import { Debug } from '../../core/debug.js';
import { hashCode } from '../../core/hash.js';
import { SEMANTIC_POSITION, getGlslShaderType } from '../../platform/graphics/constants.js';
import { BlendState } from '../../platform/graphics/blend-state.js';
import { RenderTarget } from '../../platform/graphics/render-target.js';
import { QuadRender } from '../../scene/graphics/quad-render.js';
import { RenderPassShaderQuad } from '../../scene/graphics/render-pass-shader-quad.js';
import { ShaderUtils } from '../../scene/shader-lib/shader-utils.js';
import { GSPLAT_STREAM_INSTANCE } from '../../scene/constants.js';
import glslGsplatProcess from '../../scene/shader-lib/glsl/chunks/gsplat/frag/gsplatProcess.js';
import wgslGsplatProcess from '../../scene/shader-lib/wgsl/chunks/gsplat/frag/gsplatProcess.js';

/**
 * @import { GraphicsDevice } from '../../platform/graphics/graphics-device.js'
 * @import { GSplatResourceBase } from '../../scene/gsplat/gsplat-resource-base.js'
 * @import { GSplatStreamDescriptor } from '../../scene/gsplat/gsplat-format.js'
 * @import { Texture as TextureType } from '../../platform/graphics/texture.js'
 * @import { StorageBuffer } from '../../platform/graphics/storage-buffer.js'
 * @import { GSplatComponent } from '../components/gsplat/component.js'
 */

/**
 * @typedef {object} GSplatProcessorBinding
 * Configuration object specifying a data binding for GSplatProcessor.
 * Defines where to read from (source) or write to (destination) including
 * the resource, component for instance textures, and which streams to access.
 * @property {GSplatResourceBase} [resource] - Resource to read/write from.
 * @property {GSplatComponent} [component] - Component for instance textures. If provided,
 * resource is automatically resolved from the component.
 * @property {string[]} [streams] - Names of streams to read/write. For destination, this is
 * required. For source, if omitted, all format streams except destination streams are used
 * automatically, providing getCenter/getColor/etc functions. Specify explicitly to limit
 * which streams are bound.
 */

/**
 * GSplatProcessor enables GPU-based processing of Gaussian Splat data using custom shader code.
 * Gaussian Splats store per-splat attributes (position, rotation, scale, color, spherical harmonics)
 * in texture streams. This processor reads from source streams and writes results to destination
 * streams, enabling operations like painting, selection marking, or custom data transforms.
 *
 * Custom streams can be added to loaded gsplat resources via {@link GSplatFormat#addExtraStreams},
 * or you can create fully procedural splat data using {@link GSplatContainer}.
 *
 * The source and destination can reference the same resource or component, as long as the read and
 * write streams don't overlap (you cannot read and write the same stream in one pass).
 *
 * By default (when source streams are not specified), the processor provides access to the format's
 * built-in getCenter(), getRotation(), getScale(), and getColor() functions for reading splat data.
 * Note: getCenter() must be called first as it loads shared data used by the other functions.
 *
 * Custom uniforms can be passed to the shader via {@link setParameter}, including scalar values,
 * vectors, and additional textures for effects like brush patterns or lookup tables.
 *
 * The following built-in uniforms are available in processing shaders:
 * - `srcNumSplats` (uint) - Number of splats in source resource
 * - `dstNumSplats` (uint) - Number of splats in destination resource
 *
 * @example
 * // Create a processor that reads splat positions and writes to a customColor texture
 * const processor = new pc.GSplatProcessor(
 *     app.graphicsDevice,
 *     { component: entity.gsplat },  // source: all streams auto-bound
 *     { component: entity.gsplat, streams: ['customColor'] }, // destination: customColor stream only
 *     {
 *         processGLSL: `
 *             uniform vec4 uPaintSphere;
 *             uniform vec4 uPaintColor;
 *
 *             void process() {
 *                 vec3 center = getCenter();
 *                 float dist = distance(center, uPaintSphere.xyz);
 *                 if (dist < uPaintSphere.w) {
 *                     writeCustomColor(uPaintColor);
 *                 } else {
 *                     writeCustomColor(vec4(0.0));
 *                 }
 *             }
 *         `,
 *         processWGSL: `
 *             uniform uPaintSphere: vec4f;
 *             uniform uPaintColor: vec4f;
 *
 *             fn process() {
 *                 let center = getCenter();
 *                 let dist = distance(center, uniform.uPaintSphere.xyz);
 *                 if (dist < uniform.uPaintSphere.w) {
 *                     writeCustomColor(uniform.uPaintColor);
 *                 } else {
 *                     writeCustomColor(vec4f(0.0));
 *                 }
 *             }
 *         `
 *     }
 * );
 *
 * // Set uniforms and execute
 * processor.setParameter('uPaintSphere', [0, 1, 0, 0.5]);
 * processor.setParameter('uPaintColor', [1, 0, 0, 1]);
 * processor.process();
 *
 * @category Graphics
 */
class GSplatProcessor {
    /**
     * @type {GraphicsDevice}
     * @private
     */
    _device;

    /**
     * Source binding configuration.
     *
     * @type {GSplatProcessorBinding}
     * @private
     */
    _source;

    /**
     * Destination binding configuration.
     *
     * @type {GSplatProcessorBinding}
     * @private
     */
    _destination;

    /**
     * Source resource (resolved from binding).
     *
     * @type {GSplatResourceBase}
     * @private
     */
    _srcResource;

    /**
     * Destination resource (resolved from binding).
     *
     * @type {GSplatResourceBase}
     * @private
     */
    _dstResource;

    /**
     * @type {GSplatStreamDescriptor[]}
     * @private
     */
    _dstStreamDescriptors;

    /**
     * Set of destination stream names for quick lookup.
     *
     * @type {Set<string>}
     * @private
     */
    _dstStreamNames;

    /**
     * Whether to use all input streams (no specific source streams requested).
     *
     * @type {boolean}
     * @private
     */
    _useAllInputStreams;

    /**
     * Pre-resolved source textures to bind during process().
     *
     * @type {Array<{name: string, texture: TextureType}>}
     * @private
     */
    _srcTextures = [];

    /**
     * @type {RenderTarget|null}
     * @private
     */
    _renderTarget = null;

    /**
     * @type {QuadRender|null}
     * @private
     */
    _quadRender = null;

    /**
     * @type {RenderPassShaderQuad|null}
     * @private
     */
    _renderPass = null;

    /**
     * Shader parameters set by the user.
     *
     * @type {Map<string, { scopeId: object, data: number|number[]|ArrayBufferView|TextureType|StorageBuffer }>}
     * @private
     */
    _parameters = new Map();

    /**
     * The blend state to use when processing. Allows accumulation of results
     * (e.g., additive blending for painting). Defaults to no blending.
     *
     * @type {BlendState}
     */
    blendState = BlendState.NOBLEND;

    /**
     * Creates a new GSplatProcessor instance.
     *
     * @param {GraphicsDevice} device - The graphics device.
     * @param {GSplatProcessorBinding} source - Source configuration specifying where to read from.
     * Can specify resource directly or component (for instance textures).
     * @param {GSplatProcessorBinding} destination - Destination configuration specifying where to write.
     * Can specify resource directly or component (for instance textures).
     * @param {object} options - Shader options for the processing logic.
     * @param {string} [options.processGLSL] - GLSL code at module scope. Must define a `void process()`
     * function that implements the processing logic. Can include uniform declarations and helper functions.
     * @param {string} [options.processWGSL] - WGSL code at module scope. Must define a `fn process()`
     * function that implements the processing logic. Can include uniform declarations and helper functions.
     */
    constructor(device, source, destination, options) {
        this._device = device;
        this._source = source;
        this._destination = destination;

        // Resolve resources from bindings
        this._srcResource = source.resource ?? source.component?.resource;
        this._dstResource = destination.resource ?? destination.component?.resource;

        Debug.assert(this._srcResource, 'GSplatProcessor: Source resource not found. Provide resource or component.');
        Debug.assert(this._dstResource, 'GSplatProcessor: Destination resource not found. Provide resource or component.');
        this._dstStreamDescriptors = [];
        this._dstStreamNames = new Set();

        // Validate and collect destination stream descriptors
        for (const streamName of destination.streams) {
            const stream = this._dstResource.format.getStream(streamName);
            Debug.assert(stream, `GSplatProcessor: Destination stream '${streamName}' not found in resource format.`);
            if (stream) {
                this._dstStreamDescriptors.push(stream);
                this._dstStreamNames.add(stream.name);
            }
        }

        // Determine if using all input streams (no specific source streams requested)
        this._useAllInputStreams = !source.streams?.length;

        // Pre-resolve source textures
        const srcFormat = this._srcResource.format;
        const srcStreams = this._useAllInputStreams ?
            [...srcFormat.streams, ...srcFormat.extraStreams] :
            source.streams.map(name => ({ name }));

        for (const stream of srcStreams) {
            const texture = this._resolveTexture(source, stream.name, this._srcResource);
            Debug.assert(texture, `GSplatProcessor: Texture '${stream.name}' not found`);
            this._srcTextures.push({ name: stream.name, texture });
        }

        // Create render target with MRT for destination streams
        this._createRenderTarget();

        // Create shader and quad render
        this._createShader(options);

        // Create render pass
        this._renderPass = new RenderPassShaderQuad(device);
        this._renderPass.quadRender = this._quadRender;
        this._renderPass.init(this._renderTarget);
        this._renderPass.colorOps.clear = false;
        this._renderPass.depthStencilOps.clearDepth = false;
    }

    /**
     * Destroys this processor and releases all resources.
     */
    destroy() {
        this._renderTarget?.destroy();
        this._renderTarget = null;

        this._quadRender?.destroy();
        this._quadRender = null;

        this._renderPass?.destroy();
        this._renderPass = null;

        this._parameters.clear();
    }

    /**
     * Resolves a texture for the given stream name from a binding configuration.
     *
     * Resolution order:
     * 1. Component instance texture (if component provided and stream is instance-level)
     * 2. Resource texture
     *
     * @param {GSplatProcessorBinding} binding - The binding configuration.
     * @param {string} name - The stream name.
     * @param {GSplatResourceBase} resource - The resolved resource.
     * @returns {TextureType|null} The resolved texture, or null if not found.
     * @private
     */
    _resolveTexture(binding, name, resource) {
        // Check component for instance textures
        if (binding.component) {
            const stream = resource.format.getStream(name);
            if (stream?.storage === GSPLAT_STREAM_INSTANCE) {
                const texture = binding.component.getInstanceTexture(name);
                if (texture) {
                    return texture;
                }
            }
        }

        // Fall back to resource texture
        const texture = resource.getTexture(name);
        if (!texture) {
            Debug.error(`GSplatProcessor: Texture '${name}' not found`);
        }
        return texture;
    }

    /**
     * Creates the MRT render target for destination streams.
     *
     * @private
     */
    _createRenderTarget() {
        const colorBuffers = [];
        Debug.assert(this._dstStreamDescriptors.length > 0, 'GSplatProcessor: No destination streams specified.');

        for (const stream of this._dstStreamDescriptors) {
            const texture = this._resolveTexture(this._destination, stream.name, this._dstResource);
            if (texture) {
                colorBuffers.push(texture);
            } else {
                Debug.error(`GSplatProcessor: Destination texture stream '${stream.name}' not found.`);
            }
        }

        if (colorBuffers.length > 0) {
            this._renderTarget = new RenderTarget({
                name: 'GSplatProcessor-MRT',
                colorBuffers: colorBuffers,
                depth: false,
                flipY: true
            });
        }
    }

    /**
     * Creates the shader and QuadRender for processing.
     *
     * @param {object} options - Shader options.
     * @private
     */
    _createShader(options) {
        const { processGLSL = '', processWGSL = '' } = options;
        const device = this._device;
        const srcFormat = this._srcResource.format;
        const dstFormat = this._dstResource.format;

        // Generate input declarations
        let inputDeclarations = '';
        let readCode = '';

        if (this._useAllInputStreams) {
            // No source streams specified - use all format streams
            const allStreams = [...srcFormat.streams, ...srcFormat.extraStreams];

            // Only filter out destination streams when source and destination are the same resource
            // (can't read and write the same texture in one pass). When they're different resources,
            // include all source streams even if they have the same names as destination streams.
            const sameResource = this._srcResource === this._dstResource;
            const inputStreamNames = allStreams
            .filter(s => !sameResource || !this._dstStreamNames.has(s.name))
            .map(s => s.name);

            // Include declarations for input streams, plus the read code (getCenter/getColor/etc)
            inputDeclarations = srcFormat.getInputDeclarations(inputStreamNames);
            readCode = srcFormat.getReadCode();
        } else {
            // Specific source streams requested - use only those
            inputDeclarations = srcFormat.getInputDeclarations(this._source.streams);
        }

        // Generate output declarations (write functions)
        const outputDeclarations = dstFormat.getOutputDeclarations(this._dstStreamDescriptors);

        // Build fragment output types for MRT
        const fragmentOutputTypes = this._dstStreamDescriptors.map((stream) => {
            const info = getGlslShaderType(stream.format);
            return info.returnType;
        });

        // Create defines
        const defines = new Map();
        defines.set('SH_BANDS', '0'); // SH processing is currently not supported.

        const isWebGPU = device.isWebGPU;

        // Create shader includes for current platform
        // User's process code provides process() function + any declarations at module scope
        const includes = new Map();
        includes.set('gsplatProcessInputVS', inputDeclarations);
        includes.set('gsplatProcessOutputVS', outputDeclarations);
        includes.set('gsplatProcessReadVS', readCode);
        includes.set('gsplatProcessChunk', isWebGPU ? processWGSL : processGLSL);

        // shader unique name hash
        const hash = hashCode([
            isWebGPU ? processWGSL : processGLSL,
            this._useAllInputStreams ? '1' : '0'
        ].join('|'));
        const outputStreams = this._dstStreamDescriptors.map(s => s.name).join(',');

        // Create shader
        const shader = ShaderUtils.createShader(device, {
            uniqueName: `GSplatProcessor:${srcFormat.hash};${hash};out=${outputStreams}`,
            attributes: { vertex_position: SEMANTIC_POSITION },
            vertexDefines: defines,
            fragmentDefines: defines,
            vertexChunk: 'fullscreenQuadVS',
            fragmentGLSL: glslGsplatProcess,
            fragmentWGSL: wgslGsplatProcess,
            fragmentIncludes: includes,
            fragmentOutputTypes: fragmentOutputTypes
        });

        this._quadRender = new QuadRender(shader);
    }

    /**
     * Sets a shader parameter for this processor. Parameters are applied during processing.
     *
     * @param {string} name - The name of the parameter (uniform name in shader).
     * @param {number|number[]|ArrayBufferView|TextureType|StorageBuffer} data - The value for the parameter.
     */
    setParameter(name, data) {
        const scopeId = this._device.scope.resolve(name);
        this._parameters.set(name, { scopeId, data });
    }

    /**
     * Gets a shader parameter value previously set with {@link setParameter}.
     *
     * @param {string} name - The name of the parameter.
     * @returns {number|number[]|ArrayBufferView|TextureType|StorageBuffer|undefined} The parameter value, or undefined if not set.
     */
    getParameter(name) {
        return this._parameters.get(name)?.data;
    }

    /**
     * Removes a shader parameter.
     *
     * @param {string} name - The name of the parameter to remove.
     */
    deleteParameter(name) {
        this._parameters.delete(name);
    }

    /**
     * Executes the processing, reading from source streams and writing to destination streams.
     */
    process() {
        if (!this._renderPass) {
            Debug.warn('GSplatProcessor: Cannot process - not initialized.');
            return;
        }

        const device = this._device;

        // Bind pre-resolved source textures
        for (const { name, texture } of this._srcTextures) {
            device.scope.resolve(name).setValue(texture);
        }

        // Set texture size and splat count uniforms
        device.scope.resolve('splatTextureSize').setValue(this._srcResource.textureDimensions.x);
        device.scope.resolve('dstTextureSize').setValue(this._dstResource.textureDimensions.x);
        device.scope.resolve('srcNumSplats').setValue(this._srcResource.numSplats);
        device.scope.resolve('dstNumSplats').setValue(this._dstResource.numSplats);

        // Bind non-texture parameters from resource (e.g., dequantization uniforms for SOG)
        for (const [name, value] of this._srcResource.parameters) {
            device.scope.resolve(name).setValue(value);
        }

        // Apply user parameters
        for (const [, param] of this._parameters) {
            param.scopeId.setValue(param.data);
        }

        // Execute render pass
        this._renderPass.blendState = this.blendState;
        this._renderPass.render();
    }
}

export { GSplatProcessor };
