import { TRACEID_GPU_TIMINGS } from "../../core/constants.js";
import { Debug } from "../../core/debug.js";
import { Tracing } from "../../core/tracing.js";

/**
 * A class implementing a simple GPU profiler.
 */
class GpuProfiler {
    /**
     * @type {Map<string, number>}
     * @ignore
     */
    namesMap = new Map();

    /**
     * @type {string[]}
     * @ignore
     */
    indexedNames = [];

    /**
     * @type {number[]}
     * @ignore
     */
    frameAllocations = [];

    pastFrameAllocations = new Map();

    _enabled = false;

    _enableRequest = false;

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
                    const name = this.indexedNames[allocations[i]];
                    Debug.trace(TRACEID_GPU_TIMINGS, `${timings[i].toFixed(2)} ms ${name}`);
                }
            }
        }

        // remove frame info
        this.pastFrameAllocations.delete(renderVersion);
    }

    getNameIndex(name) {
        let index = this.namesMap.get(name);
        if (index === undefined) {
            index = this.namesMap.size;
            this.namesMap.set(name, index);
            this.indexedNames[index] = name;
        }
        return index;
    }

    getSlot(name) {
        const nameIndex = this.getNameIndex(name);
        const slot = this.frameAllocations.length;
        this.frameAllocations.push(nameIndex);
        return slot;
    }

    get slotCount() {
        return this.frameAllocations.length;
    }
}

export { GpuProfiler };
