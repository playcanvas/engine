import { FramePass } from './frame-pass.js';

/**
 * @import { Compute } from './compute.js'
 * @import { GraphicsDevice } from './graphics-device.js'
 */

/**
 * A frame pass which dispatches a list of compute instances, in order, in a single compute pass.
 * It schedules compute work at a position in the frame, for example after a camera renders, to
 * process its scene depth and color maps in the same frame. To dispatch compute instances right
 * away instead, when called, use {@link GraphicsDevice#computeDispatch}. Compute shaders are only
 * supported on WebGPU, see {@link GraphicsDevice#supportsCompute}. On other devices the pass
 * executes without dispatching anything.
 *
 * ## Adding the pass to a frame
 *
 * Add the pass to the {@link CameraComponent#beforePasses} or the
 * {@link CameraComponent#afterPasses} of a camera, to dispatch it before or after the camera
 * renders, or to the {@link FramePass#beforePasses} or {@link FramePass#afterPasses} of another
 * pass. It can also be rendered on its own, with {@link FramePass#render}. Set its
 * {@link FramePass#name}, which labels the dispatch in GPU profiling. The pass does not destroy
 * its compute instances, and the camera does not destroy the pass: whoever creates them destroys
 * them.
 *
 * ## The dispatch
 *
 * Each compute instance is dispatched with the dispatch size and parameters set on it, typically
 * set before the frame renders, or in {@link FramePass#onBefore}. Use onBefore also to prepare the
 * buffers the shaders write, for example to clear them, and {@link FramePass#onAfter} to read the
 * results back, as a read requested there is recorded right after the dispatch. The pass executes
 * at most once in a frame.
 *
 * ## XR views
 *
 * When the frame renders multiple XR views, {@link ComputePass#xrViewIndex} selects the view the
 * pass executes in. As a compute instance is dispatched at most once in a frame, dispatching for
 * several views needs a compute pass for each, with separate compute instances.
 *
 * @example
 * // A compute shader building a histogram of what a camera renders, into a storage buffer
 * cameraComponent.requestSceneColorMap(true);
 *
 * const compute = new Compute(device, shader, 'Histogram');
 * compute.setSceneColorMap(cameraComponent.sceneColorMapHandle);
 * compute.setParameter('bins', histogramBuffer);
 *
 * const pass = new ComputePass(device, [compute]);
 * pass.name = 'HistogramPass';
 *
 * // right before the dispatch: a thread for each pixel, and an empty buffer
 * pass.onBefore = () => {
 *     compute.setupDispatchThreads(device.width, device.height);
 *     histogramBuffer.clear();
 * };
 *
 * // read the result back right after the dispatch
 * pass.onAfter = () => {
 *     histogramBuffer.read().then((data) => {
 *         // the histogram, which arrives a few frames after it was computed
 *     });
 * };
 *
 * // dispatch after the camera renders, so the shader reads the scene color of the same frame
 * cameraComponent.afterPasses.push(pass);
 *
 * // when no longer needed, remove the pass, and destroy it and the compute instance
 * const passes = cameraComponent.afterPasses;
 * passes.splice(passes.indexOf(pass), 1);
 * pass.destroy();
 * compute.destroy();
 *
 * @category Graphics
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

    /**
     * Renders the pass, as {@link FramePass#render} describes. When the frame renders multiple XR
     * views, it executes only in the view selected by {@link ComputePass#xrViewIndex}, and is
     * skipped in the others.
     */
    render() {
        // the index of the XR view being rendered, or -1 outside of the views
        const viewIndex = this.device.xrCurrentViewIndex ?? -1;
        if (viewIndex >= 0 ? viewIndex === this._xrViewIndex : this._xrViewIndex <= 0) {
            super.render();
        }
    }

    /**
     * Dispatches the compute instances in {@link ComputePass#computes}, in order, in a single
     * compute pass labelled with {@link FramePass#name}. Does nothing when there are none.
     */
    execute() {
        const { computes } = this;
        if (computes.length) {
            this.device.computeDispatch(computes, this.name);
        }
    }

    /**
     * Releases the pass. It empties {@link ComputePass#computes}, without destroying the compute
     * instances, which are destroyed by whoever created them.
     */
    destroy() {
        this.computes = [];

        super.destroy();
    }
}

export { ComputePass };
