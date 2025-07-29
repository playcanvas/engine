import { EventHandler } from '../../../core/event-handler.js';
import { platform } from '../../../core/platform.js';
import { UnifiedSortWorker } from './gsplat-unified-sort-worker.js';

class GSplatUnifiedSorter extends EventHandler {
    worker;

    bufferLength = 0;

    availableOrderData = [];

    // track how many jobs are in flight
    jobsInFlight = 0;

    // true if we have new version to process
    hasNewVersion = false;

    constructor() {
        super();

        const workerSource = `(${UnifiedSortWorker.toString()})()`;

        if (platform.environment === 'node') {
            this.worker = new Worker(workerSource, {
                eval: true
            });
            this.worker.on('message', this.onSorted.bind(this));
        } else {
            this.worker = new Worker(URL.createObjectURL(new Blob([workerSource], {
                type: 'application/javascript'
            })));
            this.worker.addEventListener('message', this.onSorted.bind(this));
        }
    }

    onSorted(message) {

        const msgData = message.data ?? message;
        const returnCenters = msgData.returnCenters ? new Float32Array(msgData.returnCenters) : null;
        const orderData = new Uint32Array(msgData.order);

        // decrement jobs in flight counter
        this.jobsInFlight--;

        this.fire('sorted', msgData.count, msgData.version, returnCenters, orderData);

        // reuse order data
        if (orderData.length === this.bufferLength) {
            this.availableOrderData.push(orderData);
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

        // we have a new version to process
        this.hasNewVersion = true;

        // output size matches input size, clear available data when it changes
        const newLength = centers.length / 3;  // 3 floats per center
        if (newLength !== this.bufferLength) {
            this.bufferLength = newLength;
            this.availableOrderData.length = 0;
        }

        // post data to worker
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
     */
    setSortParams(params) {

        // only process job requests if we have a new version or no jobs are in flight
        if (this.hasNewVersion || this.jobsInFlight === 0) {

            // reuse or allocate new order data
            let initOrderData = false;
            let orderData = this.availableOrderData.pop();
            if (!orderData) {
                orderData = new Uint32Array(this.bufferLength);
                initOrderData = true;
            }

            // worker management
            this.jobsInFlight++;
            this.hasNewVersion = false;

            // send job to worker
            this.worker.postMessage({
                sortParams: params,
                order: orderData.buffer,
                initOrderData: initOrderData
            }, [
                orderData.buffer
            ]);
        }
    }
}

export { GSplatUnifiedSorter };
