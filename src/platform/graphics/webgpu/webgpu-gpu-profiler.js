import { DebugHelper } from "../../../core/debug.js";
import { GpuProfiler } from "../gpu-profiler.js";
import { WebgpuQuerySet } from "./webgpu-query-set.js";

class WebgpuGpuProfiler extends GpuProfiler {
    device;

    /** @type {number} */
    frameGPUMarkerSlot;

    constructor(device) {
        super();
        this.device = device;

        // gpu timing queries
        this.timestampQueriesSet = device.supportsTimestampQuery ? new WebgpuQuerySet(device, true, 512) : null;
    }

    destroy() {
        this.timestampQueriesSet?.destroy();
        this.timestampQueriesSet = null;
    }

    frameMarker(isStart) {

        if (this.timestampQueriesSet) {

            const suffix = isStart ? 'Start' : 'End';
            const commandEncoder = this.device.wgpu.createCommandEncoder();
            DebugHelper.setLabel(commandEncoder, `GPUTimestampEncoder-${suffix}`);

            this.frameGPUMarkerSlot = isStart ? this.getSlot('GpuFrame') : this.frameGPUMarkerSlot;
            commandEncoder.writeTimestamp(this.timestampQueriesSet.querySet, this.frameGPUMarkerSlot * 2 + (isStart ? 0 : 1));

            const cb = commandEncoder.finish();
            DebugHelper.setLabel(cb, `GPUTimestampEncoder-${suffix}-CommandBuffer`);

            this.device.addCommandBuffer(cb, isStart);
        }
    }

    frameStart() {

        this.processEnableRequest();

        if (this._enabled) {
            // initial timing marker
            this.frameMarker(true);
        }
    }

    frameEnd() {

        if (this._enabled) {
            // final timing marker
            this.frameMarker(false);

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
