/**
 * @import { GSplatInfo } from "./gsplat-info.js"
 */

import { Debug } from '../../../core/debug.js';

/**
 * Manages a buffer to store gsplat centers.
 *
 * @ignore
 */
class GSplatCentersBuffers {
    /** @type {number} */
    version = 0;

    /** @type {number} */
    _numCenters = 0;

    /** @type {Float32Array[]} */
    _available = [];

    /** @type {number} */
    textureSize = 0;

    /**
     * Get a buffer from the pool, or allocate a new one.
     *
     * @param {number} numCenters - The number of centers the buffer should hold.
     * @returns {Float32Array} - A buffer from the pool or a new one
     */
    get(numCenters) {

        if (numCenters !== this._numCenters) {
            this._numCenters = numCenters;
            this._available.length = 0;
        }

        return this._available.pop() || new Float32Array(numCenters * 3);
    }

    /**
     * Reclaim a buffer.
     *
     * @param {Float32Array} buffer - The buffer to reclaim.
     */
    put(buffer) {
        if (buffer.length === this._numCenters * 3) {
            this._available.push(buffer);
        }
    }

    /**
     * Updates the centers buffer with the given splats.
     *
     * @param {GSplatInfo[]} splats - The splats to update with.
     * @param {number} textureSize - The texture size.
     * @returns {Float32Array} - The updated centers buffer.
     */
    update(splats, textureSize) {

        const centers = this.get(textureSize * textureSize);

        splats.forEach((splat) => {
            // Update centers using LOD intervals for remapping
            this.updateCentersWithLod(splat, textureSize, centers);
        });

        this.version++;
        return centers;
    }

    /**
     * Updates centers array using LOD intervals for remapping
     *
     * @param {GSplatInfo} splat - The splat to update centers for
     * @param {number} textureSize - The texture size
     * @param {Float32Array} centers - The centers buffer
     */
    updateCentersWithLod(splat, textureSize, centers) {
        const { prepareState, resource } = splat;
        const hasLod = resource.hasLod;
        const srcCenters = resource.centers;
        const dstBaseOffset = prepareState.lineStart * 3 * textureSize;
        const intervals = prepareState.intervals;
        let targetIndex = 0;

        if (hasLod) {
            // copy centers based on LOD intervals
            for (let i = 0; i < intervals.length; i += 2) {
                const intervalStart = intervals[i];
                const intervalEnd = intervals[i + 1];
                const intervalLength = intervalEnd - intervalStart;

                // Calculate source and destination ranges
                const srcStart = intervalStart * 3;
                const srcEnd = intervalEnd * 3;
                const dstStart = dstBaseOffset + targetIndex * 3;

                centers.set(srcCenters.subarray(srcStart, srcEnd), dstStart);

                targetIndex += intervalLength;
            }
        } else {
            // copy all centers
            centers.set(srcCenters, dstBaseOffset);
        }
    }

    /**
     * Estimates the square texture size width that can store all splats, using binary search to
     * find the smallest size that fits.
     *
     * @param {GSplatInfo[]} splats - The splats to allocate space for.
     * @param {number} maxSize - Max texture width and height.
     * @returns {boolean} - True if the texture size was found.
     */
    estimateTextureWidth(splats, maxSize) {
        const fits = (size) => {
            let rows = 0;
            for (const splat of splats) {
                rows += Math.ceil(splat.numSplats / size);
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
            Debug.error('estimateTextureWidth: failed to find a valid texture size');
            return false;
        }

        this.textureSize = bestSize;
        return true;
    }
}

export { GSplatCentersBuffers };
