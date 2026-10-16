import { Debug, DebugHelper } from '../../core/debug.js';
import { Tracing } from '../../core/tracing.js';
import { TRACEID_RENDER_PASS } from '../../core/constants.js';

/**
 * @import { GraphicsDevice } from '../graphics/graphics-device.js'
 */

/**
 * A frame pass represents a node in the frame graph. It encapsulates a unit of work that
 * executes during frame rendering. Subclasses include {@link RenderPass} for GPU render passes
 * with render targets, and non-rendering passes for compute dispatches or other tasks.
 *
 * @ignore
 */
class FramePass {
    /** @type {string} */
    _name;

    /**
     * The graphics device.
     *
     * @type {GraphicsDevice}
     */
    device;

    /**
     * True if the frame pass is enabled.
     *
     * @private
     */
    _enabled = true;

    /**
     * True if the render pass start is skipped. This means the render pass is merged into the
     * previous one. Used by FrameGraph.compile() for pass merging.
     *
     * @private
     */
    _skipStart = false;

    /**
     * True if the render pass end is skipped. This means the following render pass is merged into
     * this one. Used by FrameGraph.compile() for pass merging.
     *
     * @private
     */
    _skipEnd = false;

    /**
     * True if the frame pass is enabled and execute function will be called. Note that before and
     * after functions are called regardless of this flag. Set it before the frame renders, at the
     * latest in frameUpdate, as the frame graph decides which passes to merge from it.
     */
    executeEnabled = true;

    /**
     * True if the pass renders once for each view when the frame renders multiple XR views, which
     * is the case for a pass rendering the views. False for a pass which does not depend on the
     * view, such as the shadow pass of a directional light, which then renders once for all views,
     * unless another such pass renders to the same target for those views. A pass rendering per
     * view can skip some of the views, such as a compute pass executing in a single view.
     *
     * @ignore
     */
    perView = true;

    /**
     * Frame passes which the engine adds for the frame, which execute before this pass and its
     * {@link FramePass#beforePasses}. A pass which depends on other passes in some frames, such as
     * the shadow passes of a forward pass, fills this in its frameUpdate, keeping the
     * beforePasses for the passes set up by the user.
     *
     * @type {FramePass[]}
     * @ignore
     */
    internalBeforePasses = [];

    /**
     * Frame passes which need to be executed before this pass. The engine does not change this
     * list, so the passes in it execute every frame this pass executes. This pass does not own
     * them, and does not destroy them: whoever adds a pass to the list destroys it.
     *
     * @type {FramePass[]}
     */
    beforePasses = [];

    /**
     * Frame passes which need to be executed after this pass. This pass does not own them, and
     * does not destroy them: whoever adds a pass to the list destroys it.
     *
     * @type {FramePass[]}
     */
    afterPasses = [];

    /**
     * Creates an instance of the FramePass.
     *
     * @param {GraphicsDevice} graphicsDevice - The graphics device.
     */
    constructor(graphicsDevice) {
        Debug.assert(graphicsDevice);
        this.device = graphicsDevice;
    }

    set name(value) {
        this._name = value;
    }

    get name() {
        if (!this._name) {
            this._name = this.constructor.name;
        }
        return this._name;
    }

    /**
     * Sets whether the frame pass is enabled. A disabled pass is skipped when the frame is built,
     * together with its {@link FramePass#beforePasses} and {@link FramePass#afterPasses}, and its
     * frameUpdate is not called. To skip only the execution of the pass, while still updating it
     * and its before and after passes, use {@link FramePass#executeEnabled} instead. Change it
     * before the frame is built: the frameUpdate of a pass, or of its before-passes, cannot disable
     * the pass itself. Defaults to true.
     *
     * @type {boolean}
     */
    set enabled(value) {
        if (this._enabled !== value) {
            this._enabled = value;
            if (value) {
                this.onEnable();
            } else {
                this.onDisable();
            }
        }
    }

    /**
     * Gets whether the frame pass is enabled.
     *
     * @type {boolean}
     */
    get enabled() {
        return this._enabled;
    }

    onEnable() {
    }

    onDisable() {
    }

    frameUpdate() {
    }

    /**
     * Called before execution when the pass is enabled, even if {@link executeEnabled} is false.
     * Overrides that require execution must check {@link executeEnabled} themselves.
     */
    before() {
    }

    execute() {
    }

    /**
     * Called after execution when the pass is enabled, even if {@link executeEnabled} is false.
     * Overrides that require execution must check {@link executeEnabled} themselves.
     */
    after() {
    }

    /**
     * Releases the resources the pass created. A pass owns only what it creates: it does not
     * destroy its {@link FramePass#beforePasses} and {@link FramePass#afterPasses}, which are
     * destroyed by whoever added them. The code which creates a pass destroys it, once, and the
     * pass is not used after that - in debug builds, adding a destroyed pass to a frame reports an
     * error. Subclasses releasing their own resources call `super.destroy()`.
     */
    destroy() {
        DebugHelper.setDestroyed(this);
    }

    render() {
        if (this.enabled) {

            Debug.call(() => {
                this.log(this.device, this.device.renderPassIndex);
            });

            this.before();
            if (this.executeEnabled) {
                this.execute();
            }
            this.after();
            this.device.renderPassIndex++;
        }
    }

    // #if _DEBUG
    log(device, index = 0) {
        if (Tracing.get(TRACEID_RENDER_PASS)) {
            const indexString = index.toString().padEnd(2, ' ');
            Debug.trace(TRACEID_RENDER_PASS,
                `${indexString}: ${this.name.padEnd(20, ' ')}` +
                `${this.executeEnabled ? '' : ' DISABLED '}`);
        }
    }
    // #endif
}

export { FramePass };
