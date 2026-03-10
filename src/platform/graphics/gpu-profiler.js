import { TRACEID_GPU_TIMINGS } from '../../core/constants.js';
import { Debug } from '../../core/debug.js';
import { Tracing } from '../../core/tracing.js';

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
     * True if enabled in the current frame.
     *
     * @private
     */
    _enabled = false;

    /**
     * The enable request for the next frame.
     *
     * @private
     */
    _enableRequest = false;

    /**
     * The time it took to render the last frame on GPU, or 0 if the profiler is not enabled.
     *
     * @private
     */
    _frameTime = 0;

    /**
     * Per-pass timing data, with accumulated timings for passes with the same name.
     *
     * @type {Map<string, number>}
     * @private
     */
    _passTimings = new Map();

    /**
     * Cache for parsed pass names to avoid repeated string operations.
     *
     * @type {Map<string, string>}
     * @private
     */
    _nameCache = new Map();

    /**
     * The maximum number of slots that can be allocated during the frame.
     *
     * @type {number}
     */
    maxCount = 9999;

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

    /**
     * Get the per-pass timing data.
     *
     * @type {Map<string, number>}
     * @ignore
     */
    get passTimings() {
        return this._passTimings;
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

    /**
     * Parse a render pass name to a simplified form for stats.
     * Uses a cache to avoid repeated string operations.
     *
     * @param {string} name - The original pass name (e.g., "RenderPassCompose").
     * @returns {string} The parsed name (e.g., "compose").
     * @private
     */
    _parsePassName(name) {
        // check cache first
        let parsedName = this._nameCache.get(name);
        if (parsedName === undefined) {
            // remove "RenderPass" prefix if present
            if (name.startsWith('RenderPass')) {
                parsedName = name.substring(10);
            } else {
                parsedName = name;
            }
            this._nameCache.set(name, parsedName);
        }
        return parsedName;
    }

    report(renderVersion, timings) {

        if (timings) {
            const allocations = this.pastFrameAllocations.get(renderVersion);
            if (!allocations) {
                return;
            }
            Debug.assert(allocations.length === timings.length);

            // store frame duration
            if (timings.length > 0) {
                this._frameTime = timings.reduce((sum, t) => sum + t, 0);
            }

            // clear old pass timings
            this._passTimings.clear();

            // accumulate per-pass timings
            for (let i = 0; i < allocations.length; ++i) {
                const name = allocations[i];
                const timing = timings[i];
                const parsedName = this._parsePassName(name);

                // accumulate timings for passes with the same name
                this._passTimings.set(parsedName, (this._passTimings.get(parsedName) || 0) + timing);
            }

            // log out timings
            if (Tracing.get(TRACEID_GPU_TIMINGS)) {
                Debug.trace(TRACEID_GPU_TIMINGS, `-- GPU timings for frame ${renderVersion} --`);
                let total = 0;
                for (let i = 0; i < allocations.length; ++i) {
                    const name = allocations[i];
                    total += timings[i];
                    Debug.trace(TRACEID_GPU_TIMINGS, `${timings[i].toFixed(2)} ms ${name}`);
                }
                Debug.trace(TRACEID_GPU_TIMINGS, `${total.toFixed(2)} ms TOTAL`);
            }
        }

        // remove frame info
        this.pastFrameAllocations.delete(renderVersion);
    }

    /**
     * Allocate a slot for GPU timing during the frame. This slot is valid only for the current
     * frame. This allows multiple timers to be used during the frame, each with a unique name.
     *
     * @param {string} name - The name of the slot.
     * @returns {number} The assigned slot index, or -1 if the slot count exceeds the maximum number
     * of slots.
     *
     * @ignore
     */
    getSlot(name) {
        if (this.frameAllocations.length >= this.maxCount) {
            return -1;
        }
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
