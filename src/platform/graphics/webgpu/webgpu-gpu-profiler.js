import { GpuProfiler } from '../gpu-profiler.js';
import { WebgpuQuerySet } from './webgpu-query-set.js';

class WebgpuGpuProfiler extends GpuProfiler {
    device;

    /** @type {number} */
    frameGPUMarkerSlot;

    constructor(device) {
        super();
        this.device = device;

        // gpu timing queries
        // magnopus patch - disale timestamp queries because it creates too many
        this.timestampQueriesSet = device.supportsTimestampQuery ? null : null;
    }

    destroy() {
        this.timestampQueriesSet?.destroy();
        this.timestampQueriesSet = null;
    }

    frameStart() {
        this.processEnableRequest();
    }

    frameEnd() {
        if (this._enabled) {
            // schedule command buffer where timestamps are copied to CPU
            this.timestampQueriesSet?.resolve(this.slotCount * 2);
        }
    }

    request() {
        if (this._enabled) {
            // request results
            const renderVersion = this.device.renderVersion;
            this.timestampQueriesSet?.request(this.slotCount, renderVersion).then((results) => {
                this.report(results.renderVersion, results.timings);
            });

            super.request(renderVersion);
        }
    }
}

export { WebgpuGpuProfiler };
