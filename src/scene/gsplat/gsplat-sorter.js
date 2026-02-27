import { EventHandler } from '../../core/event-handler.js';
import { platform } from '../../core/platform.js';
import { UploadStream } from '../../platform/graphics/upload-stream.js';
import { SortWorker } from './gsplat-sort-worker.js';

/**
 * @import { GraphicsDevice } from '../../platform/graphics/graphics-device.js'
 * @import { StorageBuffer } from '../../platform/graphics/storage-buffer.js'
 * @import { Texture } from '../../platform/graphics/texture.js'
 */

class GSplatSorter extends EventHandler {
    worker;

    /** @type {Texture|StorageBuffer} */
    target;

    /** @type {ArrayBuffer} */
    orderData;

    centers;

    scene;

    /** @type {UploadStream} */
    uploadStream;

    /**
     * @param {GraphicsDevice} device - The graphics device.
     * @param {import('../scene.js').Scene} [scene] - The scene to fire sort timing events on.
     */
    constructor(device, scene) {
        super();
        this.scene = scene ?? null;
        this.uploadStream = new UploadStream(device);

        const messageHandler = (message) => {
            const msgData = message.data ?? message;

            if (this.scene && msgData.sortTime !== undefined) {
                this.scene.fire('gsplat:sorted', msgData.sortTime);
            }

            const newOrder = msgData.order;
            const oldOrder = this.orderData;

            // send previous buffer to worker for reuse
            this.worker.postMessage({
                order: oldOrder
            }, [oldOrder]);

            // upload new order data to GPU
            const data = new Uint32Array(newOrder);
            this.orderData = newOrder;
            this.uploadStream.upload(data, this.target);

            this.fire('updated', msgData.count);
        };

        const workerSource = `(${SortWorker.toString()})()`;

        if (platform.environment === 'node') {
            this.worker = new Worker(workerSource, {
                eval: true
            });
            this.worker.on('message', messageHandler);
        } else {
            this.worker = new Worker(URL.createObjectURL(new Blob([workerSource], {
                type: 'application/javascript'
            })));
            this.worker.addEventListener('message', messageHandler);
        }
    }

    destroy() {
        this.worker.terminate();
        this.worker = null;
        this.uploadStream.destroy();
        this.uploadStream = null;
    }

    /**
     * @param {Texture|StorageBuffer} target - The GPU target for order data uploads.
     * @param {number} numSplats - The number of splats.
     * @param {Float32Array} centers - The splat center positions.
     * @param {Uint32Array} [chunks] - Optional chunk data.
     */
    init(target, numSplats, centers, chunks) {
        this.target = target;
        this.centers = centers.slice();

        const orderBuffer = new Uint32Array(numSplats);
        for (let i = 0; i < numSplats; ++i) {
            orderBuffer[i] = i;
        }

        // second buffer for double-buffering with the worker
        this.orderData = new ArrayBuffer(numSplats * 4);

        const obj = {
            order: orderBuffer.buffer,
            centers: centers.buffer,
            chunks: chunks?.buffer
        };

        const transfer = [orderBuffer.buffer, centers.buffer].concat(chunks ? [chunks.buffer] : []);

        this.worker.postMessage(obj, transfer);
    }

    setMapping(mapping) {
        if (mapping) {
            const centers = new Float32Array(mapping.length * 3);
            for (let i = 0; i < mapping.length; ++i) {
                const src = mapping[i] * 3;
                const dst = i * 3;
                centers[dst + 0] = this.centers[src + 0];
                centers[dst + 1] = this.centers[src + 1];
                centers[dst + 2] = this.centers[src + 2];
            }

            this.worker.postMessage({
                centers: centers.buffer,
                mapping: mapping.buffer
            }, [centers.buffer, mapping.buffer]);
        } else {
            const centers = this.centers.slice();
            this.worker.postMessage({
                centers: centers.buffer,
                mapping: null
            }, [centers.buffer]);
        }
    }

    setCamera(pos, dir) {
        this.worker.postMessage({
            cameraPosition: { x: pos.x, y: pos.y, z: pos.z },
            cameraDirection: { x: dir.x, y: dir.y, z: dir.z }
        });
    }
}

export { GSplatSorter };
