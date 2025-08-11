/**
 * @import { GSplatInfo } from "./gsplat-info.js"
 */

import { Debug } from '../../core/debug.js';

/**
 * Manages a buffer to store gsplat centers.
 *
 * @ignore
 */
class GSplatCentersBuffers {
    /** @type {number} */
    version = 0;

    /** @type {number} */
    textureSize = 0;

    /**
     * When LOD changes, prepare data for sorter worker to be able to construct global centers
     * array for sorting.
     *
     * @param {GSplatInfo[]} splats - The splats to update with.
     * @returns {object} - Data for sorter worker.
     */
    update(splats) {

        this.version++;

        return {
            command: 'intervals',
            textureSize: this.textureSize,
            version: this.version,
            ids: splats.map(splat => splat.resource.id),
            lineStarts: splats.map(splat => splat.prepareState.lineStart),
            padding: splats.map(splat => splat.prepareState.padding),

            // TODO: consider storing this in typed array and transfer it to sorter worker
            intervals: splats.map(splat => splat.prepareState.intervals)
        };
    }

    /**
     * Estimates the square texture size that can store all splats, using binary search to find the
     * smallest size that fits.
     *
     * @param {GSplatInfo[]} splats - The splats to allocate space for.
     * @param {number} maxSize - Max texture size (width and height).
     * @returns {boolean} - True if the texture size was found.
     */
    estimateTextureSize(splats, maxSize) {
        const fits = (size) => {
            let rows = 0;
            for (const splat of splats) {
                // rows += Math.ceil(splat.numSplats / size);
                rows += Math.ceil(splat.prepareState.activeSplats / size);
                if (rows > size) return false;
            }
            return true;
        };

        let low = 1;
        let high = maxSize;
        let bestSize = null;

        while (low <= high) {
            const mid = Math.floor((low + high) / 2);
            if (fits(mid)) {
                bestSize = mid;
                high = mid - 1;
            } else {
                low = mid + 1;
            }
        }

        if (bestSize === null) {
            this.textureSize = 0;
            Debug.error('estimateTextureSize: failed to find a valid texture size');
            return false;
        }

        this.textureSize = bestSize;
        return true;
    }
}

export { GSplatCentersBuffers };
