import { TRACEID_PIPELINELAYOUT_ALLOC } from '../../../core/constants.js';
import { Debug, DebugHelper } from '../../../core/debug.js';

/**
 * @import { BindGroupFormat } from '../bind-group-format.js'
 * @import { WebgpuGraphicsDevice } from './webgpu-graphics-device.js'
 */

let _layoutId = 0;

/**
 * Base class for render and compute pipelines.
 *
 * @ignore
 */
class WebgpuPipeline {
    constructor(device) {
        /** @type {WebgpuGraphicsDevice} */
        this.device = device;
    }

    /**
     * Compares two pipeline cache keys. Used instead of a generic array comparison, whose element
     * access is shared with plain arrays elsewhere and so is slower on the typed arrays the keys
     * are - the comparison runs on every pipeline cache hit.
     *
     * @param {Uint32Array} a - A key.
     * @param {Uint32Array} b - Another key, of the same length.
     * @returns {boolean} True if the keys are equal.
     */
    static keysEqual(a, b) {
        for (let i = 0; i < a.length; i++) {
            if (a[i] !== b[i]) {
                return false;
            }
        }
        return true;
    }

    // TODO: this could be cached using bindGroupKey

    /**
     * @param {BindGroupFormat[]} bindGroupFormats - An array of bind group formats.
     * @returns {any} Returns the pipeline layout.
     */
    getPipelineLayout(bindGroupFormats) {

        // the layout cannot skip an index - a gap would shift every following bind group to a
        // wrong slot, so each index up to the highest bound group needs a format
        const bindGroupLayouts = [];
        for (let i = 0; i < bindGroupFormats.length; i++) {
            const format = bindGroupFormats[i];
            Debug.assert(format, `Bind group format at index ${i} is not set, the pipeline layout cannot have a gap.`);
            bindGroupLayouts.push(format.bindGroupLayout);
        }

        const desc = {
            bindGroupLayouts: bindGroupLayouts
        };

        _layoutId++;
        DebugHelper.setLabel(desc, `PipelineLayoutDescr-${_layoutId}`);

        /** @type {GPUPipelineLayout} */
        const pipelineLayout = this.device.wgpu.createPipelineLayout(desc);
        DebugHelper.setLabel(pipelineLayout, `PipelineLayout-${_layoutId}`);
        Debug.trace(TRACEID_PIPELINELAYOUT_ALLOC, `Alloc: Id ${_layoutId}`, {
            desc: desc,
            bindGroupFormats
        });

        return pipelineLayout;
    }
}

export { WebgpuPipeline };
