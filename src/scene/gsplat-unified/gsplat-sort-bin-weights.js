/**
 * A utility class for computing camera-relative bin weights used in GSplat sorting.
 * Pre-allocates a single interleaved Float32Array that is reused across frames.
 * Used by both GPU (GSplatSortKeyCompute) and CPU worker sorting paths.
 *
 * This class is stringified and injected into the worker blob, so it must be
 * fully self-contained: no imports, and all constants as static properties.
 *
 * @ignore
 */
class GSplatSortBinWeights {
    /**
     * Number of bins for camera-relative precision weighting.
     *
     * @type {number}
     */
    static NUM_BINS = 32;

    /**
     * Weight tiers for camera-relative precision (distance from camera bin -> weight multiplier).
     * Closer bins get more precision for better visual quality near the camera.
     *
     * @type {Array<{maxDistance: number, weight: number}>}
     */
    static WEIGHT_TIERS = [
        { maxDistance: 0, weight: 40.0 },   // Camera bin
        { maxDistance: 2, weight: 20.0 },   // Adjacent bins
        { maxDistance: 5, weight: 8.0 },    // Nearby bins
        { maxDistance: 10, weight: 3.0 },   // Medium distance
        { maxDistance: Infinity, weight: 1.0 }  // Far bins
    ];

    /**
     * Pre-allocated interleaved array [base0, divider0, base1, divider1, ...].
     *
     * @type {Float32Array}
     */
    binWeights = new Float32Array(GSplatSortBinWeights.NUM_BINS * 2);

    /**
     * Pre-computed weight lookup table by distance from camera (constant).
     *
     * @type {Float32Array}
     */
    weightByDistance;

    /**
     * Pre-allocated scratch array for bits per bin calculation.
     *
     * @type {Float32Array}
     */
    bitsPerBin;

    /**
     * Cached cameraBin from last compute call.
     *
     * @type {number}
     */
    lastCameraBin = -1;

    /**
     * Cached bucketCount from last compute call.
     *
     * @type {number}
     */
    lastBucketCount = -1;

    /**
     * Creates a new GSplatSortBinWeights instance.
     */
    constructor() {
        const numBins = GSplatSortBinWeights.NUM_BINS;
        const weightTiers = GSplatSortBinWeights.WEIGHT_TIERS;

        // Pre-allocate scratch array
        this.bitsPerBin = new Float32Array(numBins);

        // Pre-compute weight lookup table by distance from camera (constant)
        this.weightByDistance = new Float32Array(numBins);
        for (let dist = 0; dist < numBins; dist++) {
            let weight = 1.0;
            for (let j = 0; j < weightTiers.length; j++) {
                if (dist <= weightTiers[j].maxDistance) {
                    weight = weightTiers[j].weight;
                    break;
                }
            }
            this.weightByDistance[dist] = weight;
        }
    }

    /**
     * Computes the camera bin index based on sort mode and distance range.
     *
     * @param {boolean} radialSort - Whether using radial sort mode.
     * @param {number} minDist - Minimum distance.
     * @param {number} range - Distance range (maxDist - minDist).
     * @returns {number} The camera bin index (0 to NUM_BINS-1).
     */
    static computeCameraBin(radialSort, minDist, range) {
        const numBins = GSplatSortBinWeights.NUM_BINS;
        if (radialSort) {
            // For radial sort with inverted distances, camera (dist=0) maps to the last bin
            return numBins - 1;
        }
        // For linear sort, calculate where camera falls in the projected distance range
        const cameraOffsetFromRangeStart = -minDist;
        const cameraBinFloat = (cameraOffsetFromRangeStart / range) * numBins;
        return Math.max(0, Math.min(numBins - 1, Math.floor(cameraBinFloat)));
    }

    /**
     * Computes bin weights for the given camera bin and bucket count.
     * Results are cached - returns immediately if inputs haven't changed.
     *
     * @param {number} cameraBin - The bin index where the camera is located (0 to NUM_BINS-1).
     * @param {number} bucketCount - Total number of sorting buckets (typically 2^numBits).
     * @returns {Float32Array} The same binWeights array with computed values.
     */
    compute(cameraBin, bucketCount) {
        // Return cached result if inputs haven't changed
        if (cameraBin === this.lastCameraBin && bucketCount === this.lastBucketCount) {
            return this.binWeights;
        }

        // Update cache
        this.lastCameraBin = cameraBin;
        this.lastBucketCount = bucketCount;

        const numBins = GSplatSortBinWeights.NUM_BINS;
        const bitsPerBin = this.bitsPerBin;

        // Assign weights to bins based on pre-calculated distance lookup
        for (let i = 0; i < numBins; i++) {
            const distFromCamera = Math.abs(i - cameraBin);
            bitsPerBin[i] = this.weightByDistance[distFromCamera];
        }

        // Normalize to fit within budget
        let totalWeight = 0;
        for (let i = 0; i < numBins; i++) {
            totalWeight += bitsPerBin[i];
        }

        // Write to binWeights array (interleaved base, divider pairs)
        let accumulated = 0;
        for (let i = 0; i < numBins; i++) {
            const divider = Math.max(1, Math.floor((bitsPerBin[i] / totalWeight) * bucketCount));
            this.binWeights[i * 2] = accumulated;       // base
            this.binWeights[i * 2 + 1] = divider;       // divider
            accumulated += divider;
        }

        // Adjust last bin to fit exactly
        if (accumulated > bucketCount) {
            const excess = accumulated - bucketCount;
            const lastDividerIdx = (numBins - 1) * 2 + 1;
            this.binWeights[lastDividerIdx] = Math.max(1, this.binWeights[lastDividerIdx] - excess);
        }

        return this.binWeights;
    }
}

export { GSplatSortBinWeights };
