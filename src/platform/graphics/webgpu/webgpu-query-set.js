import { DebugHelper } from "../../../core/debug.js";

/**
 * A wrapper over the GpuQuerySet object, allowing timestamp and occlusion queries. The results
 * are copied back using staging buffers to avoid blocking.
 *
 * @ignore
 */
class WebgpuQuerySet {
    /**
     * @type {GPUQuerySet}
     */
    querySet;

    stagingBuffers = [];

    activeStagingBuffer = null;

    /** @type {number} */
    bytesPerSlot;

    constructor(device, isTimestamp, capacity) {
        this.device = device;
        this.capacity = capacity;
        this.bytesPerSlot = isTimestamp ? 8 : 4;

        // query set
        const wgpu = device.wgpu;
        this.querySet = wgpu.createQuerySet({
            type: isTimestamp ? 'timestamp' : 'occlusion',
            count: capacity
        });
        DebugHelper.setLabel(this.querySet, `QuerySet-${isTimestamp ? 'Timestamp' : 'Occlusion'}`);

        // gpu buffer for query results GPU writes to
        this.queryBuffer = wgpu.createBuffer({
            size: this.bytesPerSlot * capacity,
            usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST
        });
        DebugHelper.setLabel(this.queryBuffer, 'QueryGpuBuffer');
    }

    destroy() {
        this.querySet?.destroy();
        this.querySet = null;

        this.queryBuffer?.destroy();
        this.queryBuffer = null;

        this.activeStagingBuffer = null;

        this.stagingBuffers.forEach((stagingBuffer) => {
            stagingBuffer.destroy();
        });
        this.stagingBuffers = null;
    }

    getStagingBuffer() {
        let stagingBuffer = this.stagingBuffers.pop();
        if (!stagingBuffer) {
            stagingBuffer = this.device.wgpu.createBuffer({
                size: this.queryBuffer.size,
                usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
            });
            DebugHelper.setLabel(this.queryBuffer, 'QueryStagingBuffer');

        }
        return stagingBuffer;
    }

    resolve(count) {
        const device = this.device;
        const commandEncoder = device.wgpu.createCommandEncoder();
        DebugHelper.setLabel(commandEncoder, 'ResolveQuerySet-Encoder');

        // copy times to the gpu buffer
        commandEncoder.resolveQuerySet(this.querySet, 0, count, this.queryBuffer, 0);

        // copy the gpu buffer to the staging buffer
        const activeStagingBuffer = this.getStagingBuffer();
        this.activeStagingBuffer = activeStagingBuffer;

        commandEncoder.copyBufferToBuffer(this.queryBuffer, 0, activeStagingBuffer, 0, this.bytesPerSlot * count);

        const cb = commandEncoder.finish();
        DebugHelper.setLabel(cb, 'ResolveQuerySet');
        device.addCommandBuffer(cb);
    }

    request(count, renderVersion) {
        const stagingBuffer = this.activeStagingBuffer;
        this.activeStagingBuffer = null;

        return stagingBuffer.mapAsync(GPUMapMode.READ).then(() => {

            // timestamps in nanoseconds. Note that this array is valid only till we unmap the staging buffer.
            const srcTimings = new BigInt64Array(stagingBuffer.getMappedRange());

            // convert to ms per sample pair
            const timings = [];
            for (let i = 0; i < count; i++) {
                timings.push(Number(srcTimings[i * 2 + 1] - srcTimings[i * 2]) * 0.000001);
            }

            stagingBuffer.unmap();
            this.stagingBuffers?.push(stagingBuffer);

            return {
                renderVersion,
                timings
            };
        });
    }
}

export { WebgpuQuerySet };
