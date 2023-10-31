import { TRACEID_PIPELINELAYOUT_ALLOC } from '../../../core/constants.js';
import { Debug, DebugHelper } from '../../../core/debug.js';

let _layoutId = 0;

/**
 * Base class for render and compute pipelines.
 *
 * @ignore
 */
class WebgpuPipeline {
    constructor(device) {
        /** @type {import('./webgpu-graphics-device.js').WebgpuGraphicsDevice} */
        this.device = device;
    }

    // TODO: this could be cached using bindGroupKey

    /**
     * @param {import('../bind-group-format.js').BindGroupFormat[]} bindGroupFormats - An array
     * of bind group formats.
     * @returns {any} Returns the pipeline layout.
     */
    getPipelineLayout(bindGroupFormats) {

        const bindGroupLayouts = [];
        bindGroupFormats.forEach((format) => {
            bindGroupLayouts.push(format.bindGroupLayout);
        });

        const descr = {
            bindGroupLayouts: bindGroupLayouts
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

        return pipelineLayout;
    }
}

export { WebgpuPipeline };
