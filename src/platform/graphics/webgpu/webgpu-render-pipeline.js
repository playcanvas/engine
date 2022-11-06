import { Debug } from "../../../core/debug.js";

import { WebgpuVertexBufferLayout } from "./webgpu-vertex-buffer-layout.js";

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
    'constant',             // BLENDMODE_CONSTANT_COLOR
    'one-minus-constant',   // BLENDMODE_ONE_MINUS_CONSTANT_COLOR
    undefined,              // BLENDMODE_CONSTANT_ALPHA
    undefined               // BLENDMODE_ONE_MINUS_CONSTANT_ALPHA
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

    // TODO: somehow pass entity name to assign to things, maybe hook up to GraphicsDebug stuff

    get(primitive, vertexFormat0, vertexFormat1, shader, renderTarget, bindGroupFormats, renderState) {

        // render pipeline unique key
        const key = this.getKey(primitive, vertexFormat0, vertexFormat1, shader, renderTarget, bindGroupFormats, renderState);

        // cached pipeline
        let pipeline = this.cache.get(key);
        if (!pipeline) {

            const primitiveTopology = _primitiveTopology[primitive.type];
            Debug.assert(primitiveTopology, `Unsupported primitive topology ${primitive}`);

            // pipeline layout
            const pipelineLayout = this.getPipelineLayout(bindGroupFormats);

            // vertex buffer layout
            const vertexBufferLayout = this.vertexBufferLayout.get(vertexFormat0, vertexFormat1);

            // pipeline
            pipeline = this.create(primitiveTopology, shader.impl, renderTarget, pipelineLayout, renderState, vertexBufferLayout);
            this.cache.set(key, pipeline);
        }

        return pipeline;
    }

    /**
     * Generate a unique key for the render pipeline. Keep this function as lean as possible,
     * as it executes for each draw call.
     */
    getKey(primitive, vertexFormat0, vertexFormat1, shader, renderTarget, bindGroupFormats, renderState) {

        let bindGroupKey = '';
        for (let i = 0; i < bindGroupFormats.length; i++) {
            bindGroupKey += bindGroupFormats[i].key;
        }

        const vertexBufferLayoutKey = this.vertexBufferLayout.getKey(vertexFormat0, vertexFormat1);
        const renderTargetKey = renderTarget.impl.key;
        const renderStateKey = renderState.blendKey;

        return vertexBufferLayoutKey + shader.impl.vertexCode + shader.impl.fragmentCode +
            renderTargetKey + renderStateKey + primitive.type + bindGroupKey;
    }

    // TODO: this could be cached using bindGroupKey
    getPipelineLayout(bindGroupFormats) {

        bindGroupFormats.forEach((format) => {
            _bindGroupLayouts.push(format.bindGroupLayout);
        });

        /** @type {GPUPipelineLayout} */
        const pipelineLayout = this.device.wgpu.createPipelineLayout({
            bindGroupLayouts: _bindGroupLayouts
        });
        _bindGroupLayouts.length = 0;

        return pipelineLayout;
    }

    getBlend(renderState) {
        /** @type {GPUBlendState} */
        const blend = {
            color: {
                operation: _blendOperation[renderState.blendEquationColor],
                srcFactor: _blendFactor[renderState.blendSrcColor],
                dstFactor: _blendFactor[renderState.blendDstColor]
            },
            alpha: {
                operation: _blendOperation[renderState.blendEquationAlpha],
                srcFactor: _blendFactor[renderState.blendSrcAlpha],
                dstFactor: _blendFactor[renderState.blendDstAlpha]
            }
        };

        // unsupported blend factors
        Debug.assert(blend.color.srcFactor !== undefined);
        Debug.assert(blend.color.dstFactor !== undefined);
        Debug.assert(blend.alpha.srcFactor !== undefined);
        Debug.assert(blend.alpha.dstFactor !== undefined);

        return blend;
    }

    create(primitiveTopology, webgpuShader, renderTarget, pipelineLayout, renderState, vertexBufferLayout) {

        const wgpu = this.device.wgpu;

        /** @type {GPUDepthStencilState} */
        const depthStencil = renderTarget.depth ? {
            depthWriteEnabled: true,
            depthCompare: 'less',
            format: renderTarget.impl.depthFormat
        } : undefined;

        return wgpu.createRenderPipeline({
            vertex: {
                module: wgpu.createShaderModule({
                    code: webgpuShader.vertexCode
                }),
                entryPoint: 'main',
                buffers: vertexBufferLayout
            },
            fragment: {
                module: wgpu.createShaderModule({
                    code: webgpuShader.fragmentCode
                }),
                entryPoint: 'main',
                targets: [{
                    format: renderTarget.impl.colorFormat,
                    writeMask: GPUColorWrite.ALL,
                    blend: this.getBlend(renderState)
                }]
            },
            primitive: {
                topology: primitiveTopology,
                cullMode: "none"
            },

            depthStencil,

            multisample: {
                count: renderTarget.samples
            },

            // uniform / texture binding layout
            layout: pipelineLayout
        });
    }
}

export { WebgpuRenderPipeline };
