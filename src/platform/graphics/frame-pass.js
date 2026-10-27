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
 * In each frame a pass is part of, for example as a frame pass of a camera, or as a before or
 * after pass of another pass, it goes through these steps:
 *
 * - While the frame is built, before anything renders: {@link FramePass#frameUpdate} is called,
 * and then the {@link FramePass#beforePasses} and {@link FramePass#afterPasses} of the pass are
 * added to the frame around it. A disabled pass is skipped, together with those passes.
 * - While the frame renders: {@link FramePass#before} and {@link FramePass#onBefore} are called,
 * then {@link FramePass#execute} while {@link FramePass#executeEnabled} is true, and then
 * {@link FramePass#after} and {@link FramePass#onAfter}.
 *
 * A pass can also be rendered on its own, outside of a frame, by calling {@link FramePass#render}.
 *
 * @category Graphics
 */
class FramePass {
    /**
     * @type {string}
     * @private
     */
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
     * Called when the pass renders, right before it executes: after {@link FramePass#before}, and
     * for a render pass before its GPU render pass starts. Work recorded here, such as setting the
     * parameters of the pass, or clearing a buffer it writes to, executes right before the pass.
     * Like before, it is called even if {@link FramePass#executeEnabled} is false, but not when the
     * pass is disabled. A render pass with this callback is not merged with the pass before it into
     * a single GPU render pass, so the callback runs outside of one.
     *
     * @type {((pass: this) => void)|null}
     */
    onBefore = null;

    /**
     * Called when the pass renders, right after it executes: for a render pass once its GPU render
     * pass has ended, and after {@link FramePass#after}. The results the pass writes can be read
     * back here, as a read records its copy when it is requested, and so right after the pass.
     * Reads should not be immediate, as that submits the work of the frame recorded so far. Like
     * after, it is called even if {@link FramePass#executeEnabled} is false, but not when the pass
     * is disabled. A render pass with this callback is not merged with the pass after it into a
     * single GPU render pass, so the callback runs outside of one.
     *
     * @type {((pass: this) => void)|null}
     */
    onAfter = null;

    /**
     * Creates an instance of the FramePass.
     *
     * @param {GraphicsDevice} graphicsDevice - The graphics device.
     */
    constructor(graphicsDevice) {
        Debug.assert(graphicsDevice);
        this.device = graphicsDevice;
    }

    /**
     * Sets the name of the pass, which identifies it in debug output, GPU profiling and graphics
     * debuggers. Defaults to the name of its class, which minified builds can shorten, so set it
     * explicitly for a readable name.
     *
     * @type {string}
     */
    set name(value) {
        this._name = value;
    }

    /**
     * Gets the name of the pass.
     *
     * @type {string}
     */
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

    /**
     * Called when the pass is enabled, by setting {@link FramePass#enabled} to true while it is
     * false. Override to recreate what {@link FramePass#onDisable} released.
     */
    onEnable() {
    }

    /**
     * Called when the pass is disabled, by setting {@link FramePass#enabled} to false while it is
     * true. Override to release what the pass does not need while it is disabled, such as its
     * render targets.
     */
    onDisable() {
    }

    /**
     * Called each frame the pass is added to the frame, while the frame is built and before
     * anything renders, and before its {@link FramePass#beforePasses} and
     * {@link FramePass#afterPasses} are added. Override to update the pass for the frame, for
     * example to resize its render targets, to set the textures it reads, to add or remove its
     * before and after passes and enable or disable them, or to set its
     * {@link FramePass#executeEnabled}. It cannot disable the pass itself. It is not called for a
     * disabled pass, nor when the pass is rendered on its own with {@link FramePass#render}.
     */
    frameUpdate() {
    }

    /**
     * Called while the pass renders, before {@link FramePass#execute}. It is called even when
     * {@link FramePass#executeEnabled} is false and the pass does not execute, so an override
     * preparing only for the execution can skip that work while executeEnabled is false.
     */
    before() {
    }

    /**
     * Records the work of the pass. Called while the frame renders, between
     * {@link FramePass#before} and {@link FramePass#after}, and only while
     * {@link FramePass#executeEnabled} is true. For a {@link RenderPass}, it runs inside the GPU
     * render pass, which starts right before it.
     */
    execute() {
    }

    /**
     * Called while the pass renders, after {@link FramePass#execute}. It is called even when
     * {@link FramePass#executeEnabled} is false and the pass did not execute, so an override
     * using the results of the execution can skip that work while executeEnabled is false.
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
        this.onBefore = null;
        this.onAfter = null;
        DebugHelper.setDestroyed(this);
    }

    /**
     * Renders the pass: calls {@link FramePass#before} and {@link FramePass#onBefore}, then
     * {@link FramePass#execute} while {@link FramePass#executeEnabled} is true, and then
     * {@link FramePass#after} and {@link FramePass#onAfter}. It does nothing while the pass is
     * disabled. The frame graph calls this for each pass in the frame.
     *
     * It can also be called directly, to render the pass on its own, outside of a frame, for
     * example to render into a texture once. The pass is then not prepared the way a frame
     * prepares it: its {@link FramePass#frameUpdate} is not called, its before and after passes do
     * not render, and the frame graph does not merge it with neighbouring passes, nor ask it to
     * store the attachments a later pass loads. A {@link RenderPass} rendered on its own keeps the
     * textures of its render target: its color buffers, resolved when multisampled, and its depth
     * buffer texture. It does not keep the samples of a multisampled attachment, the stencil, or a
     * depth buffer its render target creates internally, unless it is set to store them with
     * {@link RenderPass#setStoreColor}, {@link RenderPass#setStoreDepth} and
     * {@link RenderPass#setStoreStencil}.
     */
    render() {
        if (this.enabled) {

            Debug.call(() => {
                this.log(this.device, this.device.renderPassIndex);
            });

            this.before();
            this.onBefore?.(this);
            if (this.executeEnabled) {
                this.execute();
            }
            this.after();
            this.onAfter?.(this);
            this.device.renderPassIndex++;
        }
    }

    // #if _DEBUG
    /**
     * Logs the pass for the frame trace, in debug builds.
     *
     * @param {GraphicsDevice} device - The graphics device.
     * @param {number} [index] - The index of the pass in the frame.
     * @ignore
     */
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
