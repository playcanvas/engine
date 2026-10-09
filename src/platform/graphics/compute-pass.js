import { FramePass } from './frame-pass.js';

/**
 * @import { Compute } from './compute.js'
 * @import { GraphicsDevice } from './graphics-device.js'
 */

/**
 * A frame pass which dispatches a list of compute instances, in order, in a single compute pass.
 * It schedules compute work at a position in the frame, for example after a camera renders, to
 * process its scene depth and color maps in the same frame.
 *
 * Each compute instance is dispatched with the dispatch size and parameters set on it, typically
 * set before the frame renders. As a compute instance is dispatched at most once in a frame, a
 * compute pass which executes more than once in a frame, such as for each XR view, needs separate
 * compute instances for each.
 *
 * @ignore
 */
class ComputePass extends FramePass {
    /**
     * The compute instances the pass dispatches, in order. Add instances to the array, or remove
     * them from it, to change them. The pass does not own them.
     *
     * @type {Compute[]}
     */
    computes;

    /**
     * Creates a new ComputePass instance.
     *
     * @param {GraphicsDevice} graphicsDevice - The graphics device.
     * @param {Compute[]} [computes] - The compute instances the pass dispatches. Defaults to an
     * empty array.
     */
    constructor(graphicsDevice, computes = []) {
        super(graphicsDevice);
        this.computes = computes;
    }

    execute() {
        const { computes } = this;
        if (computes.length) {
            this.device.computeDispatch(computes, this.name);
        }
    }

    destroy() {
        this.computes = [];
    }
}

export { ComputePass };
