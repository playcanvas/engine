import { Debug, DebugHelper } from "../../../core/debug.js";
import { TRACEID_COMPUTEPIPELINE_ALLOC } from "../../../core/constants.js";
import { WebgpuDebug } from "./webgpu-debug.js";
import { WebgpuPipeline } from "./webgpu-pipeline.js";

/**
 * @import { WebgpuShader } from './webgpu-shader.js'
 */

let _pipelineId = 0;

class WebgpuComputePipeline extends WebgpuPipeline {
    get(shader, bindGroupFormat) {

        // pipeline layout
        const pipelineLayout = this.getPipelineLayout([bindGroupFormat.impl]);

        // TODO: this could be cached

        const pipeline = this.create(shader, pipelineLayout);
        return pipeline;
    }

    create(shader, pipelineLayout) {

        const wgpu = this.device.wgpu;

        /** @type {WebgpuShader} */
        const webgpuShader = shader.impl;

        /** @type {GPUComputePipelineDescriptor} */
        const descr = {
            compute: {
                module: webgpuShader.getComputeShaderModule(),
                entryPoint: webgpuShader.computeEntryPoint
            },

            // uniform / texture binding layout
            layout: pipelineLayout
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
