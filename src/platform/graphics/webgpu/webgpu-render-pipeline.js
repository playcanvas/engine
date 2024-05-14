import { Debug, DebugHelper } from "../../../core/debug.js";
import { hash32Fnv1a } from "../../../core/hash.js";
import { array } from "../../../core/array-utils.js";
import { TRACEID_RENDERPIPELINE_ALLOC } from "../../../core/constants.js";

import { WebgpuVertexBufferLayout } from "./webgpu-vertex-buffer-layout.js";
import { WebgpuDebug } from "./webgpu-debug.js";
import { WebgpuPipeline } from "./webgpu-pipeline.js";
import { DebugGraphics } from "../debug-graphics.js";
import { bindGroupNames } from "../constants.js";

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

/** @ignore */
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

/**
 * @ignore
 */
class WebgpuRenderPipeline extends WebgpuPipeline {
    lookupHashes = new Uint32Array(13);

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

    /** @private */
    get(primitive, vertexFormat0, vertexFormat1, shader, renderTarget, bindGroupFormats, blendState,
        depthState, cullMode, stencilEnabled, stencilFront, stencilBack) {

        Debug.assert(bindGroupFormats.length <= 3);

        // all bind groups must be set as the WebGPU layout cannot have skipped indices. Not having a bind
        // group would assign incorrect slots to the following bind groups, causing a validation errors.
        Debug.assert(bindGroupFormats[0], `BindGroup with index 0 [${bindGroupNames[0]}] is not set.`);
        Debug.assert(bindGroupFormats[1], `BindGroup with index 1 [${bindGroupNames[1]}] is not set.`);
        Debug.assert(bindGroupFormats[2], `BindGroup with index 2 [${bindGroupNames[2]}] is not set.`);

        // render pipeline unique hash
        const lookupHashes = this.lookupHashes;
        lookupHashes[0] = primitive.type;
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
        const primitiveTopology = _primitiveTopology[primitive.type];
        Debug.assert(primitiveTopology, `Unsupported primitive topology`, primitive);

        // pipeline layout
        const pipelineLayout = this.getPipelineLayout(bindGroupFormats);

        // vertex buffer layout
        const vertexBufferLayout = this.vertexBufferLayout.get(vertexFormat0, vertexFormat1);

        // pipeline
        const cacheEntry = new CacheEntry();
        cacheEntry.hashes = new Uint32Array(lookupHashes);
        cacheEntry.pipeline = this.create(primitiveTopology, shader, renderTarget, pipelineLayout, blendState,
                                          depthState, vertexBufferLayout, cullMode, stencilEnabled, stencilFront, stencilBack);

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

    /** @private */
    getDepthStencil(depthState, renderTarget, stencilEnabled, stencilFront, stencilBack) {

        /** @type {GPUDepthStencilState} */
        let depthStencil;
        const { depth, stencil } = renderTarget;
        if (depth || stencil) {

            // format of depth-stencil attachment
            depthStencil = {
                format: renderTarget.impl.depthFormat
            };

            // depth
            if (depth) {
                depthStencil.depthWriteEnabled = depthState.write;
                depthStencil.depthCompare = _compareFunction[depthState.func];
                depthStencil.depthBias = depthState.depthBias;
                depthStencil.depthBiasSlopeScale = depthState.depthBiasSlope;
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

    create(primitiveTopology, shader, renderTarget, pipelineLayout, blendState, depthState, vertexBufferLayout,
        cullMode, stencilEnabled, stencilFront, stencilBack) {

        const wgpu = this.device.wgpu;

        /** @type {import('./webgpu-shader.js').WebgpuShader} */
        const webgpuShader = shader.impl;

        /** @type {GPURenderPipelineDescriptor} */
        const descr = {
            vertex: {
                module: webgpuShader.getVertexShaderModule(),
                entryPoint: webgpuShader.vertexEntryPoint,
                buffers: vertexBufferLayout
            },

            primitive: {
                topology: primitiveTopology,
                frontFace: 'ccw',
                cullMode: _cullModes[cullMode]
            },

            depthStencil: this.getDepthStencil(depthState, renderTarget, stencilEnabled, stencilFront, stencilBack),

            multisample: {
                count: renderTarget.samples
            },

            // uniform / texture binding layout
            layout: pipelineLayout
        };

        descr.fragment = {
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
                descr.fragment.targets.push({
                    format: attachment.format,
                    writeMask: writeMask,
                    blend: blend
                });
            });
        }

        WebgpuDebug.validate(this.device);

        _pipelineId++;
        DebugHelper.setLabel(descr, `RenderPipelineDescr-${_pipelineId}`);

        const pipeline = wgpu.createRenderPipeline(descr);

        DebugHelper.setLabel(pipeline, `RenderPipeline-${_pipelineId}`);
        Debug.trace(TRACEID_RENDERPIPELINE_ALLOC, `Alloc: Id ${_pipelineId}, stack: ${DebugGraphics.toString()}`, descr);

        WebgpuDebug.end(this.device, {
            renderPipeline: this,
            descr,
            shader
        });

        return pipeline;
    }
}

export { WebgpuRenderPipeline };
