import { Debug } from '../../core/debug.js';
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
     * after functions are called regardless of this flag.
     */
    executeEnabled = true;

    /**
     * If true, this pass might use dynamically rendered cubemaps. Defaults to false for non-render
     * passes (RenderPass overrides to true).
     */
    requiresCubemaps = false;

    /**
     * Frame passes which need to be executed before this pass.
     *
     * @type {FramePass[]}
     */
    beforePasses = [];

    /**
     * Frame passes which need to be executed after this pass.
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

    get enabled() {
        return this._enabled;
    }

    onEnable() {
    }

    onDisable() {
    }

    frameUpdate() {
    }

    before() {
    }

    execute() {
    }

    after() {
    }

    destroy() {
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
