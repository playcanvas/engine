import { DynamicBuffers } from '../dynamic-buffers.js';
import { WebglDynamicBuffer } from './webgl-dynamic-buffer.js';

/**
 * @import { DynamicBufferAllocation } from '../dynamic-buffers.js'
 * @import { WebglGraphicsDevice } from './webgl-graphics-device.js'
 */

/**
 * A WebGL implementation of the dynamic buffers system. Unlike WebGPU (which sub-allocates from
 * large mapped pages and copies them to the GPU at submit time), WebGL2 has no buffer mapping and
 * executes draws immediately. So instead this hands out a whole {@link WebglDynamicBuffer} per
 * allocation from a pool keyed by size, and the buffer uploads its data eagerly using `bufferData`
 * (orphaning). Each buffer is handed out at most once per frame and returned to the free pool at
 * the end of the frame, which - together with orphaning - gives distinct buffers for uses that are
 * live at the same time (e.g. XR multiview eyes) and stall-free reuse across frames.
 *
 * @ignore
 */
class WebglDynamicBuffers extends DynamicBuffers {
    /**
     * Free buffers available for allocation, keyed by byte size.
     *
     * @type {Map<number, WebglDynamicBuffer[]>}
     */
    free = new Map();

    /**
     * Buffers handed out during the current frame, returned to the free pool at frame end.
     *
     * @type {WebglDynamicBuffer[]}
     */
    used = [];

    /**
     * @param {WebglGraphicsDevice} device - The graphics device.
     */
    constructor(device) {
        // this implementation uses a per-size whole-buffer pool, not the base bump allocator, so
        // the base buffer size / alignment are unused
        super(device, 0, 0);
    }

    destroy() {
        this.used.forEach(buffer => buffer.destroy(this.device));
        this.free.forEach(buffers => buffers.forEach(buffer => buffer.destroy(this.device)));
        this.used = null;
        this.free = null;
    }

    /**
     * Allocate a whole buffer of the given size for this frame.
     *
     * @param {DynamicBufferAllocation} allocation - The allocation info to fill.
     * @param {number} size - The size of the allocation.
     */
    alloc(allocation, size) {

        // reuse a free buffer of matching size, or create a new one
        let buffer = this.free.get(size)?.pop();
        if (!buffer) {
            buffer = new WebglDynamicBuffer(this.device, size);
        }
        this.used.push(buffer);

        // a whole buffer per allocation - the offset is always zero
        allocation.gpuBuffer = buffer;
        allocation.offset = 0;
        allocation.storage = buffer.storage;
    }

    /**
     * Return the frame's buffers to the free pool. Called at the end of the frame, so it runs after
     * all allocations (including any made before frameStart, e.g. from app update handlers).
     */
    onFrameEnd() {
        const used = this.used;
        for (let i = 0; i < used.length; i++) {
            const buffer = used[i];
            let pool = this.free.get(buffer.size);
            if (!pool) {
                pool = [];
                this.free.set(buffer.size, pool);
            }
            pool.push(buffer);
        }
        used.length = 0;
    }

    /**
     * Called when the rendering context is lost. Returns any in-flight buffers to the free pool and
     * drops every buffer's GL handle (without deleting - the context is invalid). The buffer objects
     * and their CPU storage are kept, so they are reused and their GL buffers recreated on the next
     * upload after the context is restored.
     */
    loseContext() {
        this.onFrameEnd();
        this.free.forEach((buffers) => {
            buffers.forEach(buffer => buffer.loseContext());
        });
    }
}

export { WebglDynamicBuffers };
