import { EventHandler } from '../../core/event-handler.js';
import { platform } from '../../core/platform.js';
import { UnifiedSortWorker } from './gsplat-unified-sort-worker.js';

class GSplatUnifiedSorter extends EventHandler {
    worker;

    bufferLength = 0;

    availableOrderData = [];

    // track how many jobs are in flight
    jobsInFlight = 0;

    // true if we have new version to process
    hasNewVersion = false;

    /** @type {Set<number>} */
    centersSet = new Set();

    /** @type {boolean} */
    _destroyed = false;

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

        if (this._destroyed) {
            return;
        }

        const msgData = message.data ?? message;
        const orderData = new Uint32Array(msgData.order);

        // decrement jobs in flight counter
        this.jobsInFlight--;

        this.fire('sorted', msgData.count, msgData.version, orderData);

        // reuse order data
        if (orderData.length === this.bufferLength) {
            this.availableOrderData.push(orderData);
        }
    }

    destroy() {
        this._destroyed = true;
        this.worker.terminate();
        this.worker = null;
    }

    /**
     * Adds or removes centers from the sorter.
     *
     * @param {number} id - The id of the centers.
     * @param {Float32Array|null} centers - The centers buffer.
     */
    setCenters(id, centers) {

        if (centers) { // add

            if (!this.centersSet.has(id)) {
                this.centersSet.add(id);

                // clone centers buffer - required when multiple workers sort the same splat resource
                const centersBuffer = centers.buffer.slice();

                // post centers to worker
                this.worker.postMessage({
                    command: 'addCenters',
                    id: id,
                    centers: centersBuffer
                }, [centersBuffer]);
            }

        } else { // remove

            if (this.centersSet.has(id)) {
                this.centersSet.delete(id);

                // post centers to worker
                this.worker.postMessage({
                    command: 'removeCenters',
                    id: id
                });
            }
        }
    }

    /**
     * Sets sort parameters data for sorting of splats.
     *
     * @param {object} payload - The sort parameters payload to send.
     */
    setSortParameters(payload) {

        // we have a new version to process
        this.hasNewVersion = true;

        // output size matches input size, clear available data when it changes
        const { textureSize } = payload;
        const newLength = textureSize * textureSize;
        if (newLength !== this.bufferLength) {
            this.bufferLength = newLength;
            this.availableOrderData.length = 0;
        }

        this.worker.postMessage(payload);
    }

    /**
     * Sends sorting parameters to the sorter. Called every frame sorting is needed.
     *
     * @param {object} params - The sorting parameters - per-splat directions, offsets, scales, AABBs.
     */
    setSortParams(params) {

        // only process job requests if we have a new version or no jobs are in flight
        if (this.hasNewVersion || this.jobsInFlight === 0) {

            // reuse or allocate new order data
            let orderData = this.availableOrderData.pop();
            if (!orderData) {
                orderData = new Uint32Array(this.bufferLength);
            }

            // worker management
            this.jobsInFlight++;
            this.hasNewVersion = false;

            // send job to worker
            this.worker.postMessage({
                command: 'sort',
                sortParams: params,
                order: orderData.buffer
            }, [
                orderData.buffer
            ]);
        }
    }
}

export { GSplatUnifiedSorter };
