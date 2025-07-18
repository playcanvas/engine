import { EventHandler } from '../../../core/event-handler.js';
import { platform } from '../../../core/platform.js';
import { UnifiedSortWorker } from './gsplat-unified-sort-worker.js';

class GSplatUnifiedSorter extends EventHandler {
    worker;

    constructor() {
        super();

        // message from the worker
        const messageHandler = (message) => {
            const msgData = message.data ?? message;
            const returnCenters = msgData.returnCenters ? new Float32Array(msgData.returnCenters) : null;
            const orderData = new Uint32Array(msgData.order);

            this.fire('sorted', msgData.count, msgData.version, returnCenters, orderData);
        };

        const workerSource = `(${UnifiedSortWorker.toString()})()`;

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
    }

    /**
     * Sends new centers buffer to the sorter. Called infrequently. Each centers buffer modification
     * has incremented version. This version is returned back with sorted data to identify it.
     *
     * @param {Float32Array} centers - The centers buffer.
     * @param {number} version - The version of the centers buffer.
     * @param {number} sortSplatCount - The number of splats to sort (part of centers buffer).
     */
    setData(centers, version, sortSplatCount) {
        this.worker.postMessage({
            centers: centers.buffer,
            version: version,
            sortSplatCount: sortSplatCount
        }, [centers.buffer]);
    }

    /**
     * Sends sorting parameters to the sorter. Called every frame sorting is needed.
     *
     * @param {object} params - The sorting parameters - camera positions and directions per splat range ..
     * @param {Uint32Array} orderData - The output buffer to store sorted indices.
     */
    setSortParams(params, orderData) {
        this.worker.postMessage({
            sortParams: params,
            order: orderData.buffer
        }, [orderData.buffer]);
    }
}

export { GSplatUnifiedSorter };
