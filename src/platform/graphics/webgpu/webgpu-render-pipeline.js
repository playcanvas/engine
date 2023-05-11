import { Debug, DebugHelper } from "../../../core/debug.js";
import { TRACEID_RENDERPIPELINE_ALLOC, TRACEID_PIPELINELAYOUT_ALLOC } from "../../../core/constants.js";

import { WebgpuVertexBufferLayout } from "./webgpu-vertex-buffer-layout.js";
import { WebgpuDebug } from "./webgpu-debug.js";

let _pipelineId = 0;
let _layoutId = 0;

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

// temp array to avoid allocation
const _bindGroupLayouts = [];

/**
 * @ignore
 */
class WebgpuRenderPipeline {
    constructor(device) {
        /** @type {import('./webgpu-graphics-device.js').WebgpuGraphicsDevice} */
        this.device = device;

        /**
         * The cache of vertex buffer layouts
         *
         * @type {WebgpuVertexBufferLayout}
         */
        this.vertexBufferLayout = new WebgpuVertexBufferLayout();

        /**
         * The cache of render pipelines
         *
         * @type {Map<string, object>}
         */
        this.cache = new Map();
    }

    get(primitive, vertexFormat0, vertexFormat1, shader, renderTarget, bindGroupFormats, blendState,
        depthState, cullMode, stencilEnabled, stencilFront, stencilBack) {

        // render pipeline unique key
        const key = this.getKey(primitive, vertexFormat0, vertexFormat1, shader, renderTarget, bindGroupFormats,
                                blendState, depthState, cullMode, stencilEnabled, stencilFront, stencilBack);

        // cached pipeline
        let pipeline = this.cache.get(key);
        if (!pipeline) {

            const primitiveTopology = _primitiveTopology[primitive.type];
            Debug.assert(primitiveTopology, `Unsupported primitive topology`, primitive);

            // pipeline layout
            const pipelineLayout = this.getPipelineLayout(bindGroupFormats);

            // vertex buffer layout
            const vertexBufferLayout = this.vertexBufferLayout.get(vertexFormat0, vertexFormat1);

            // pipeline
            pipeline = this.create(primitiveTopology, shader, renderTarget, pipelineLayout, blendState,
                                   depthState, vertexBufferLayout, cullMode, stencilEnabled, stencilFront, stencilBack);
            this.cache.set(key, pipeline);
        }

        return pipeline;
    }

    /**
     * Generate a unique key for the render pipeline. Keep this function as lean as possible,
     * as it executes for each draw call.
     */
    getKey(primitive, vertexFormat0, vertexFormat1, shader, renderTarget, bindGroupFormats,
        blendState, depthState, cullMode, stencilEnabled, stencilFront, stencilBack) {

        let bindGroupKey = '';
        for (let i = 0; i < bindGroupFormats.length; i++) {
            bindGroupKey += bindGroupFormats[i].key;
        }

        const vertexBufferLayoutKey = this.vertexBufferLayout.getKey(vertexFormat0, vertexFormat1);
        const renderTargetKey = renderTarget.impl.key;
        const stencilKey = stencilEnabled ? stencilFront.key + stencilBack.key : '';

        return vertexBufferLayoutKey + shader.impl.vertexCode + shader.impl.fragmentCode +
            renderTargetKey + primitive.type + bindGroupKey + blendState.key + depthState.key + cullMode + stencilKey;
    }

    // TODO: this could be cached using bindGroupKey

    /**
     * @param {import('../bind-group-format.js').BindGroupFormat[]} bindGroupFormats - An array
     * of bind group formats.
     * @returns {any} Returns the pipeline layout.
     */
    getPipelineLayout(bindGroupFormats) {

        bindGroupFormats.forEach((format) => {
            _bindGroupLayouts.push(format.bindGroupLayout);
        });

        const descr = {
            bindGroupLayouts: _bindGroupLayouts
        };

        _layoutId++;
        DebugHelper.setLabel(descr, `PipelineLayoutDescr-${_layoutId}`);

        /** @type {GPUPipelineLayout} */
        const pipelineLayout = this.device.wgpu.createPipelineLayout(descr);
        DebugHelper.setLabel(pipelineLayout, `PipelineLayout-${_layoutId}`);
        Debug.trace(TRACEID_PIPELINELAYOUT_ALLOC, `Alloc: Id ${_layoutId}`, {
            descr,
            bindGroupFormats
        });

        _bindGroupLayouts.length = 0;

        return pipelineLayout;
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

            fragment: {
                module: webgpuShader.getFragmentShaderModule(),
                entryPoint: webgpuShader.fragmentEntryPoint,
                targets: []
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

        // provide fragment targets only when render target contains color buffer, otherwise rendering to depth only
        // TODO: the exclusion of fragment here should be reflected in the key generation (no blend, no frag ..)
        const colorFormat = renderTarget.impl.colorFormat;
        if (colorFormat) {

            let writeMask = 0;
            if (blendState.redWrite) writeMask |= GPUColorWrite.RED;
            if (blendState.greenWrite) writeMask |= GPUColorWrite.GREEN;
            if (blendState.blueWrite) writeMask |= GPUColorWrite.BLUE;
            if (blendState.alphaWrite) writeMask |= GPUColorWrite.ALPHA;

            descr.fragment.targets.push({
                format: colorFormat,
                writeMask: writeMask,
                blend: this.getBlend(blendState)
            });
        }

        WebgpuDebug.validate(this.device);

        _pipelineId++;
        DebugHelper.setLabel(descr, `RenderPipelineDescr-${_pipelineId}`);

        const pipeline = wgpu.createRenderPipeline(descr);

        DebugHelper.setLabel(pipeline, `RenderPipeline-${_pipelineId}`);
        Debug.trace(TRACEID_RENDERPIPELINE_ALLOC, `Alloc: Id ${_pipelineId}`, descr);

        WebgpuDebug.end(this.device, {
            renderPipeline: this,
            descr,
            shader
        });

        return pipeline;
    }
}

export { WebgpuRenderPipeline };
