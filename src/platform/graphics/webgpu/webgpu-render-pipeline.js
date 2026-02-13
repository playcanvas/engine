import { Debug, DebugHelper } from '../../../core/debug.js';
import { hash32Fnv1a } from '../../../core/hash.js';
import { array } from '../../../core/array-utils.js';
import { TRACEID_RENDERPIPELINE_ALLOC } from '../../../core/constants.js';
import { WebgpuVertexBufferLayout } from './webgpu-vertex-buffer-layout.js';
import { WebgpuDebug } from './webgpu-debug.js';
import { WebgpuPipeline } from './webgpu-pipeline.js';
import { DebugGraphics } from '../debug-graphics.js';
import { bindGroupNames, FRONTFACE_CCW, PRIMITIVE_LINESTRIP, PRIMITIVE_TRISTRIP } from '../constants.js';

/**
 * @import { BindGroupFormat } from '../bind-group-format.js'
 * @import { BlendState } from '../blend-state.js'
 * @import { DepthState } from '../depth-state.js'
 * @import { RenderTarget } from '../render-target.js'
 * @import { Shader } from '../shader.js'
 * @import { StencilParameters } from '../stencil-parameters.js'
 * @import { VertexFormat } from '../vertex-format.js'
 * @import { WebgpuShader } from './webgpu-shader.js'
 */

let _pipelineId = 0;

const _primitiveTopology = [
    'point-list',       // PRIMITIVE_POINTS
    'line-list',        // PRIMITIVE_LINES
    undefined,          // PRIMITIVE_LINELOOP
    'line-strip',       // PRIMITIVE_LINESTRIP
    'triangle-list',    // PRIMITIVE_TRIANGLES
    'triangle-strip',   // PRIMITIVE_TRISTRIP
    undefined           // PRIMITIVE_TRIFAN
];

const _blendOperation = [
    'add',              // BLENDEQUATION_ADD
    'subtract',         // BLENDEQUATION_SUBTRACT
    'reverse-subtract', // BLENDEQUATION_REVERSE_SUBTRACT
    'min',              // BLENDEQUATION_MIN
    'max'               // BLENDEQUATION_MAX
];

const _blendFactor = [
    'zero',                 // BLENDMODE_ZERO
    'one',                  // BLENDMODE_ONE
    'src',                  // BLENDMODE_SRC_COLOR
    'one-minus-src',        // BLENDMODE_ONE_MINUS_SRC_COLOR
    'dst',                  // BLENDMODE_DST_COLOR
    'one-minus-dst',        // BLENDMODE_ONE_MINUS_DST_COLOR
    'src-alpha',            // BLENDMODE_SRC_ALPHA
    'src-alpha-saturated',  // BLENDMODE_SRC_ALPHA_SATURATE
    'one-minus-src-alpha',  // BLENDMODE_ONE_MINUS_SRC_ALPHA
    'dst-alpha',            // BLENDMODE_DST_ALPHA
    'one-minus-dst-alpha',  // BLENDMODE_ONE_MINUS_DST_ALPHA
    'constant',             // BLENDMODE_CONSTANT
    'one-minus-constant'    // BLENDMODE_ONE_MINUS_CONSTANT
];

const _compareFunction = [
    'never',                // FUNC_NEVER
    'less',                 // FUNC_LESS
    'equal',                // FUNC_EQUAL
    'less-equal',           // FUNC_LESSEQUAL
    'greater',              // FUNC_GREATER
    'not-equal',            // FUNC_NOTEQUAL
    'greater-equal',        // FUNC_GREATEREQUAL
    'always'                // FUNC_ALWAYS
];

const _cullModes = [
    'none',                 // CULLFACE_NONE
    'back',                 // CULLFACE_BACK
    'front'                 // CULLFACE_FRONT
];

const _frontFace = [
    'ccw',                  // FRONTFACE_CCW
    'cw'                    // FRONTFACE_CW
];

const _stencilOps = [
    'keep',                 // STENCILOP_KEEP
    'zero',                 // STENCILOP_ZERO
    'replace',              // STENCILOP_REPLACE
    'increment-clamp',      // STENCILOP_INCREMENT
    'increment-wrap',       // STENCILOP_INCREMENTWRAP
    'decrement-clamp',      // STENCILOP_DECREMENT
    'decrement-wrap',       // STENCILOP_DECREMENTWRAP
    'invert'                // STENCILOP_INVERT
];

const _indexFormat = [
    '',                     // INDEXFORMAT_UINT8
    'uint16',               // INDEXFORMAT_UINT16
    'uint32'                // INDEXFORMAT_UINT32
];

class CacheEntry {
    /**
     * Render pipeline
     *
     * @type {GPURenderPipeline}
     * @private
     */
    pipeline;

    /**
     * The full array of hashes used to lookup the pipeline, used in case of hash collision.
     *
     * @type {Uint32Array}
     */
    hashes;
}

class WebgpuRenderPipeline extends WebgpuPipeline {
    lookupHashes = new Uint32Array(15);

    constructor(device) {
        super(device);

        /**
         * The cache of vertex buffer layouts
         *
         * @type {WebgpuVertexBufferLayout}
         */
        this.vertexBufferLayout = new WebgpuVertexBufferLayout();

        /**
         * The cache of render pipelines
         *
         * @type {Map<number, CacheEntry[]>}
         */
        this.cache = new Map();
    }

    /**
     * @param {object} primitive - The primitive.
     * @param {VertexFormat} vertexFormat0 - The first vertex format.
     * @param {VertexFormat} vertexFormat1 - The second vertex format.
     * @param {number|undefined} ibFormat - The index buffer format.
     * @param {Shader} shader - The shader.
     * @param {RenderTarget} renderTarget - The render target.
     * @param {BindGroupFormat[]} bindGroupFormats - An array of bind group formats.
     * @param {BlendState} blendState - The blend state.
     * @param {DepthState} depthState - The depth state.
     * @param {number} cullMode - The cull mode.
     * @param {boolean} stencilEnabled - Whether stencil is enabled.
     * @param {StencilParameters} stencilFront - The stencil state for front faces.
     * @param {StencilParameters} stencilBack - The stencil state for back faces.
     * @param {number} frontFace - The front face.
     * @returns {GPURenderPipeline} Returns the render pipeline.
     * @private
     */
    get(primitive, vertexFormat0, vertexFormat1, ibFormat, shader, renderTarget, bindGroupFormats, blendState,
        depthState, cullMode, stencilEnabled, stencilFront, stencilBack, frontFace) {

        Debug.assert(bindGroupFormats.length <= 3);

        // ibFormat is used only for stripped primitives, clear it otherwise to avoid additional render pipelines
        const primitiveType = primitive.type;
        if (ibFormat && primitiveType !== PRIMITIVE_LINESTRIP && primitiveType !== PRIMITIVE_TRISTRIP) {
            ibFormat = undefined;
        }

        // all bind groups must be set as the WebGPU layout cannot have skipped indices. Not having a bind
        // group would assign incorrect slots to the following bind groups, causing a validation errors.
        Debug.assert(bindGroupFormats[0], `BindGroup with index 0 [${bindGroupNames[0]}] is not set.`);
        Debug.assert(bindGroupFormats[1], `BindGroup with index 1 [${bindGroupNames[1]}] is not set.`);
        Debug.assert(bindGroupFormats[2], `BindGroup with index 2 [${bindGroupNames[2]}] is not set.`);

        // render pipeline unique hash
        const lookupHashes = this.lookupHashes;
        lookupHashes[0] = primitiveType;
        lookupHashes[1] = shader.id;
        lookupHashes[2] = cullMode;
        lookupHashes[3] = depthState.key;
        lookupHashes[4] = blendState.key;
        lookupHashes[5] = vertexFormat0?.renderingHash ?? 0;
        lookupHashes[6] = vertexFormat1?.renderingHash ?? 0;
        lookupHashes[7] = renderTarget.impl.key;
        lookupHashes[8] = bindGroupFormats[0]?.key ?? 0;
        lookupHashes[9] = bindGroupFormats[1]?.key ?? 0;
        lookupHashes[10] = bindGroupFormats[2]?.key ?? 0;
        lookupHashes[11] = stencilEnabled ? stencilFront.key : 0;
        lookupHashes[12] = stencilEnabled ? stencilBack.key : 0;
        lookupHashes[13] = ibFormat ?? 0;
        lookupHashes[14] = frontFace;
        const hash = hash32Fnv1a(lookupHashes);

        // cached pipeline
        let cacheEntries = this.cache.get(hash);

        // if we have cache entries, find the exact match, as hash collision can occur
        if (cacheEntries) {
            for (let i = 0; i < cacheEntries.length; i++) {
                const entry = cacheEntries[i];
                if (array.equals(entry.hashes, lookupHashes)) {
                    return entry.pipeline;
                }
            }
        }

        // no match or a hash collision, so create a new pipeline
        const primitiveTopology = _primitiveTopology[primitiveType];
        Debug.assert(primitiveTopology, 'Unsupported primitive topology', primitive);

        // pipeline layout
        const pipelineLayout = this.getPipelineLayout(bindGroupFormats);

        // vertex buffer layout
        const vertexBufferLayout = this.vertexBufferLayout.get(vertexFormat0, vertexFormat1);

        // pipeline
        const cacheEntry = new CacheEntry();
        cacheEntry.hashes = new Uint32Array(lookupHashes);
        cacheEntry.pipeline = this.create(primitiveTopology, ibFormat, shader, renderTarget, pipelineLayout, blendState,
            depthState, vertexBufferLayout, cullMode, stencilEnabled, stencilFront, stencilBack, frontFace);

        // add to cache
        if (cacheEntries) {
            cacheEntries.push(cacheEntry);
        } else {
            cacheEntries = [cacheEntry];
        }
        this.cache.set(hash, cacheEntries);

        return cacheEntry.pipeline;
    }

    getBlend(blendState) {

        // blend needs to be undefined when blending is disabled
        let blend;

        if (blendState.blend) {

            /** @type {GPUBlendState} */
            blend = {
                color: {
                    operation: _blendOperation[blendState.colorOp],
                    srcFactor: _blendFactor[blendState.colorSrcFactor],
                    dstFactor: _blendFactor[blendState.colorDstFactor]
                },
                alpha: {
                    operation: _blendOperation[blendState.alphaOp],
                    srcFactor: _blendFactor[blendState.alphaSrcFactor],
                    dstFactor: _blendFactor[blendState.alphaDstFactor]
                }
            };

            // unsupported blend factors
            Debug.assert(blend.color.srcFactor !== undefined);
            Debug.assert(blend.color.dstFactor !== undefined);
            Debug.assert(blend.alpha.srcFactor !== undefined);
            Debug.assert(blend.alpha.dstFactor !== undefined);
        }

        return blend;
    }

    /**
     * @param {DepthState} depthState - The depth state.
     * @param {RenderTarget} renderTarget - The render target.
     * @param {boolean} stencilEnabled - Whether stencil is enabled.
     * @param {StencilParameters} stencilFront - The stencil state for front faces.
     * @param {StencilParameters} stencilBack - The stencil state for back faces.
     * @param {string} primitiveTopology - The primitive topology.
     * @returns {object} Returns the depth stencil state.
     * @private
     */
    getDepthStencil(depthState, renderTarget, stencilEnabled, stencilFront, stencilBack, primitiveTopology) {

        /** @type {GPUDepthStencilState} */
        let depthStencil;
        const { depth, stencil } = renderTarget;
        if (depth || stencil) {

            // format of depth-stencil attachment
            depthStencil = {
                format: renderTarget.impl.depthAttachment.format
            };

            // depth
            if (depth) {
                depthStencil.depthWriteEnabled = depthState.write;
                depthStencil.depthCompare = _compareFunction[depthState.func];

                const biasAllowed = primitiveTopology === 'triangle-list' || primitiveTopology === 'triangle-strip';
                depthStencil.depthBias = biasAllowed ? depthState.depthBias : 0;
                depthStencil.depthBiasSlopeScale = biasAllowed ? depthState.depthBiasSlope : 0;
            } else {
                // if render target does not have depth buffer
                depthStencil.depthWriteEnabled = false;
                depthStencil.depthCompare = 'always';
            }

            // stencil
            if (stencil && stencilEnabled) {

                // Note that WebGPU only supports a single mask, we use the one from front, but not from back.
                depthStencil.stencilReadMas = stencilFront.readMask;
                depthStencil.stencilWriteMask = stencilFront.writeMask;

                depthStencil.stencilFront = {
                    compare: _compareFunction[stencilFront.func],
                    failOp: _stencilOps[stencilFront.fail],
                    passOp: _stencilOps[stencilFront.zpass],
                    depthFailOp: _stencilOps[stencilFront.zfail]
                };

                depthStencil.stencilBack = {
                    compare: _compareFunction[stencilBack.func],
                    failOp: _stencilOps[stencilBack.fail],
                    passOp: _stencilOps[stencilBack.zpass],
                    depthFailOp: _stencilOps[stencilBack.zfail]
                };
            }
        }

        return depthStencil;
    }

    create(primitiveTopology, ibFormat, shader, renderTarget, pipelineLayout, blendState, depthState, vertexBufferLayout,
        cullMode, stencilEnabled, stencilFront, stencilBack, frontFace) {

        const wgpu = this.device.wgpu;

        /** @type {WebgpuShader} */
        const webgpuShader = shader.impl;

        /** @type {GPURenderPipelineDescriptor} */
        const desc = {
            vertex: {
                module: webgpuShader.getVertexShaderModule(),
                entryPoint: webgpuShader.vertexEntryPoint,
                buffers: vertexBufferLayout
            },

            primitive: {
                topology: primitiveTopology,
                frontFace: _frontFace[frontFace], // Default ccw
                cullMode: _cullModes[cullMode]
            },

            depthStencil: this.getDepthStencil(depthState, renderTarget, stencilEnabled, stencilFront, stencilBack, primitiveTopology),

            multisample: {
                count: renderTarget.samples
            },

            // uniform / texture binding layout
            layout: pipelineLayout
        };

        if (ibFormat) {
            desc.primitive.stripIndexFormat = _indexFormat[ibFormat];
        }

        desc.fragment = {
            module: webgpuShader.getFragmentShaderModule(),
            entryPoint: webgpuShader.fragmentEntryPoint,
            targets: []
        };

        const colorAttachments = renderTarget.impl.colorAttachments;
        if (colorAttachments.length > 0) {

            // the same write mask is used by all color buffers, to match the WebGL behavior
            let writeMask = 0;
            if (blendState.redWrite) writeMask |= GPUColorWrite.RED;
            if (blendState.greenWrite) writeMask |= GPUColorWrite.GREEN;
            if (blendState.blueWrite) writeMask |= GPUColorWrite.BLUE;
            if (blendState.alphaWrite) writeMask |= GPUColorWrite.ALPHA;

            // the same blend state is used by all color buffers, to match the WebGL behavior
            const blend = this.getBlend(blendState);

            colorAttachments.forEach((attachment) => {
                desc.fragment.targets.push({
                    format: attachment.format,
                    writeMask: writeMask,
                    blend: blend
                });
            });
        }

        WebgpuDebug.validate(this.device);

        _pipelineId++;
        DebugHelper.setLabel(desc, `RenderPipelineDescr-${_pipelineId}`);

        const pipeline = wgpu.createRenderPipeline(desc);

        DebugHelper.setLabel(pipeline, `RenderPipeline-${_pipelineId}`);
        Debug.trace(TRACEID_RENDERPIPELINE_ALLOC, `Alloc: Id ${_pipelineId}, stack: ${DebugGraphics.toString()}`, desc);

        WebgpuDebug.end(this.device, 'RenderPipeline creation', {
            renderPipeline: this,
            desc: desc,
            shader
        });

        return pipeline;
    }
}

export { WebgpuRenderPipeline };
