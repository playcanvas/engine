import { Debug, DebugHelper } from "../../../core/debug.js";
import { TRACEID_COMPUTEPIPELINE_ALLOC } from "../../../core/constants.js";
import { WebgpuDebug } from "./webgpu-debug.js";

let _pipelineId = 0;

/**
 * @ignore
 */
class WebgpuComputePipeline {
    constructor(device) {
        /** @type {import('./webgpu-graphics-device.js').WebgpuGraphicsDevice} */
        this.device = device;
    }

    /** @private */
    get(shader) {

        const pipeline = this.create(shader);
        return pipeline;
    }

    create(shader) {

        const wgpu = this.device.wgpu;

        /** @type {import('./webgpu-shader.js').WebgpuShader} */
        const webgpuShader = shader.impl;

        /** @type {GPUComputePipelineDescriptor} */
        const descr = {
            compute: {
                module: webgpuShader.getComputeShaderModule(),
                entryPoint: webgpuShader.computeEntryPoint
            },

            // uniform / texture binding layout
            layout: 'auto'
        };

        WebgpuDebug.validate(this.device);

        _pipelineId++;
        DebugHelper.setLabel(descr, `ComputePipelineDescr-${_pipelineId}`);

        const pipeline = wgpu.createComputePipeline(descr);

        DebugHelper.setLabel(pipeline, `ComputePipeline-${_pipelineId}`);
        Debug.trace(TRACEID_COMPUTEPIPELINE_ALLOC, `Alloc: Id ${_pipelineId}`, descr);

        WebgpuDebug.end(this.device, {
            computePipeline: this,
            descr,
            shader
        });

        return pipeline;
    }
}

export { WebgpuComputePipeline };
