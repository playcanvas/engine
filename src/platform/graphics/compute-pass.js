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
 * set before the frame renders, or in {@link ComputePass#onBefore}. The pass executes at most once
 * in a frame. When the frame renders multiple XR views, {@link ComputePass#xrViewIndex} selects
 * the view it executes in. As a compute instance is dispatched at most once in a frame, dispatching
 * for several views needs a compute pass for each, with separate compute instances.
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
     * Called when the pass executes, before it dispatches its computes. Work recorded here, such
     * as clearing a storage buffer the computes write to, executes right before the dispatch.
     *
     * @type {((pass: ComputePass) => void)|null}
     */
    onBefore = null;

    /**
     * Called when the pass executes, after it dispatches its computes. The results the computes
     * write can be read back here, as a read records its copy when it is requested, and so right
     * after the dispatch. Reads should not be immediate, as that submits the work of the frame
     * recorded so far.
     *
     * @type {((pass: ComputePass) => void)|null}
     */
    onAfter = null;

    /**
     * @type {number}
     * @private
     */
    _xrViewIndex = 0;

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

    /**
     * Sets the index of the XR view the pass executes in, when the frame renders multiple XR views
     * and the pass executes with the passes rendering them, such as in the before passes of a
     * camera. It executes at its position in that view, after what the view renders before it,
     * such as its depth prepass. Use -1 to execute it once before all the views, and so before what
     * they render. When the frame does not render multiple XR views, or the pass executes outside
     * of them, such as in the after passes of a camera, it executes when the index is -1 or 0.
     * Defaults to 0.
     *
     * @type {number}
     */
    set xrViewIndex(value) {
        this._xrViewIndex = value;

        // a pass executing before the views is moved out of them, ahead of them, while a pass
        // executing in a view stays with the passes rendering the views, and skips the other views
        this.perView = value >= 0;
    }

    /**
     * Gets the index of the XR view the pass executes in.
     *
     * @type {number}
     */
    get xrViewIndex() {
        return this._xrViewIndex;
    }

    render() {
        // the index of the XR view being rendered, or -1 outside of the views
        const viewIndex = this.device.xrCurrentViewIndex ?? -1;
        if (viewIndex >= 0 ? viewIndex === this._xrViewIndex : this._xrViewIndex <= 0) {
            super.render();
        }
    }

    before() {
        this.onBefore?.(this);
    }

    execute() {
        const { computes } = this;
        if (computes.length) {
            this.device.computeDispatch(computes, this.name);
        }
    }

    after() {
        this.onAfter?.(this);
    }

    destroy() {
        this.computes = [];
        this.onBefore = null;
        this.onAfter = null;
    }
}

export { ComputePass };
