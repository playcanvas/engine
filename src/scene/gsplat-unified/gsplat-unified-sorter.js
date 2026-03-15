import { EventHandler } from '../../core/event-handler.js';
import { platform } from '../../core/platform.js';
import { UnifiedSortWorker } from './gsplat-unified-sort-worker.js';
import { GSplatSortBinWeights } from './gsplat-sort-bin-weights.js';

/**
 * @import { GSplatInfo } from './gsplat-info.js'
 * @import { Scene } from '../scene.js'
 */

/** @type {Set<number>} */
const _neededIds = new Set();

class GSplatUnifiedSorter extends EventHandler {
    worker;

    bufferLength = 0;

    availableOrderData = [];

    // track how many jobs are in flight
    jobsInFlight = 0;

    // true if we have new version to process
    hasNewVersion = false;

    /**
     * Pending sorted result to be applied next frame. If multiple sorted results are received from
     * the worker, the latest result is stored here.
     *
     * @type {{ count: number, version: number, orderData: Uint32Array }|null}
     */
    pendingSorted = null;

    /** @type {Set<number>} */
    centersSet = new Set();

    /** @type {boolean} */
    _destroyed = false;

    /** @type {Scene|null} */
    scene = null;

    /**
     * @param {Scene} [scene] - The scene to fire sort timing events on.
     */
    constructor(scene) {
        super();
        this.scene = scene ?? null;

        // Build worker source with GSplatSortBinWeights class injected via stringification.
        const workerSource = `
            const GSplatSortBinWeights = ${GSplatSortBinWeights.toString()};
            (${UnifiedSortWorker.toString()})()
        `;

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

        // Fire sortTime event directly on scene (before result might be dropped)
        if (this.scene && msgData.sortTime !== undefined) {
            this.scene.fire('gsplat:sorted', msgData.sortTime);
        }

        const orderData = new Uint32Array(msgData.order);

        // decrement jobs in flight counter
        this.jobsInFlight--;

        // if there's already a pending result, return its orderData to the pool
        if (this.pendingSorted) {
            this.releaseOrderData(this.pendingSorted.orderData);
        }

        // store the result to be available
        this.pendingSorted = {
            count: msgData.count,
            version: msgData.version,
            orderData: orderData
        };
    }

    applyPendingSorted() {
        if (this.pendingSorted) {
            const { count, version, orderData } = this.pendingSorted;
            this.pendingSorted = null;
            this.fire('sorted', count, version, orderData);

            // reuse order data
            this.releaseOrderData(orderData);
        }
    }

    releaseOrderData(orderData) {
        if (orderData.length === this.bufferLength) {
            this.availableOrderData.push(orderData);
        }
    }

    destroy() {
        this._destroyed = true;
        this.pendingSorted = null;
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
     * Updates centers in the worker based on current splats.
     * Adds new centers and removes centers no longer needed.
     *
     * @param {GSplatInfo[]} splats - Array of active splat infos.
     */
    updateCentersForSplats(splats) {

        // collect resource IDs from current splats
        for (const splat of splats) {
            const id = splat.resource.id;
            _neededIds.add(id);

            // add centers if not already present
            if (!this.centersSet.has(id)) {
                this.setCenters(id, splat.resource.centers);
            }
        }

        // remove centers no longer needed
        for (const id of this.centersSet) {
            if (!_neededIds.has(id)) {
                this.setCenters(id, null);
            }
        }

        _neededIds.clear();
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
     * @param {boolean} radialSorting - Whether to use radial distance sorting.
     */
    setSortParams(params, radialSorting) {

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
                radialSorting: radialSorting,
                order: orderData.buffer
            }, [
                orderData.buffer
            ]);
        }
    }
}

export { GSplatUnifiedSorter };
