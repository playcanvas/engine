import { TRACEID_GPU_TIMINGS } from "../../core/constants.js";
import { Debug } from "../../core/debug.js";
import { Tracing } from "../../core/tracing.js";

/**
 * Base class of a simple GPU profiler.
 *
 * @ignore
 */
class GpuProfiler {
    /**
     * Profiling slots allocated for the current frame, storing the names of the slots.
     *
     * @type {string[]}
     * @ignore
     */
    frameAllocations = [];

    /**
     * Map of past frame allocations, indexed by renderVersion
     *
     * @type {Map<number, string[]>}
     * @ignore
     */
    pastFrameAllocations = new Map();

    /**
     * The if enabled in the current frame.
     * @ignore
     */
    _enabled = false;

    /**
     * The enable request for the next frame.
     * @ignore
     */
    _enableRequest = false;

    /**
     * The time it took to render the last frame on GPU, or 0 if the profiler is not enabled
     * @ignore
     */
    _frameTime = 0;

    loseContext() {
        this.pastFrameAllocations.clear();
    }

    /**
     * True to enable the profiler.
     *
     * @type {boolean}
     */
    set enabled(value) {
        this._enableRequest = value;
    }

    get enabled() {
        return this._enableRequest;
    }

    processEnableRequest() {
        if (this._enableRequest !== this._enabled) {
            this._enabled = this._enableRequest;
            if (!this._enabled) {
                this._frameTime = 0;
            }
        }
    }

    request(renderVersion) {
        this.pastFrameAllocations.set(renderVersion, this.frameAllocations);
        this.frameAllocations = [];
    }

    report(renderVersion, timings) {

        if (timings) {
            const allocations = this.pastFrameAllocations.get(renderVersion);
            Debug.assert(allocations.length === timings.length);

            // store frame duration
            if (timings.length > 0) {
                this._frameTime = timings[0];
            }

            // log out timings
            if (Tracing.get(TRACEID_GPU_TIMINGS)) {
                for (let i = 0; i < allocations.length; ++i) {
                    const name = allocations[i];
                    Debug.trace(TRACEID_GPU_TIMINGS, `${timings[i].toFixed(2)} ms ${name}`);
                }
            }
        }

        // remove frame info
        this.pastFrameAllocations.delete(renderVersion);
    }

    /**
     * Allocate a slot for GPU timing during the frame. This slot is valid only for the current
     * frame. This allows multiple timers to be used during the frame, each with a unique name.
     * @param {string} name - The name of the slot.
     * @returns {number} The assigned slot index.
     * @ignore
     */
    getSlot(name) {
        const slot = this.frameAllocations.length;
        this.frameAllocations.push(name);
        return slot;
    }

    /**
     * Number of slots allocated during the frame.
     *
     * @ignore
     */
    get slotCount() {
        return this.frameAllocations.length;
    }
}

export { GpuProfiler };
