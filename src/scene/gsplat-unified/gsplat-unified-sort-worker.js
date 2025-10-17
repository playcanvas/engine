function UnifiedSortWorker() {

    const myself = (typeof self !== 'undefined' && self) || (require('node:worker_threads').parentPort);

    // cache of centers for each splat id
    const centersMap = new Map();
    let centersData;
    let distances;
    let countBuffer;

    // Sorting mode: false = forward vector (directional), true = radial distance (for cubemaps)
    let _radialSort = false;

    // camera-relative bin-based precision optimization
    const numBins = 32;
    const binBase = new Array(numBins).fill(0);
    const binDivider = new Array(numBins).fill(0);

    // Weight tiers for camera-relative precision (distance from camera bin -> weight multiplier)
    const weightTiers = [
        { maxDistance: 0, weight: 40.0 },   // Camera bin
        { maxDistance: 2, weight: 20.0 },   // Adjacent bins
        { maxDistance: 5, weight: 8.0 },    // Nearby bins
        { maxDistance: 10, weight: 3.0 },   // Medium distance
        { maxDistance: Infinity, weight: 1.0 }  // Far bins
    ];

    // Pre-calculate weight lookup table by distance from camera (constant)
    const weightByDistance = new Array(numBins);
    for (let dist = 0; dist < numBins; ++dist) {
        let weight = 1.0;
        for (let j = 0; j < weightTiers.length; ++j) {
            if (dist <= weightTiers[j].maxDistance) {
                weight = weightTiers[j].weight;
                break;
            }
        }
        weightByDistance[dist] = weight;
    }

    const setupCameraRelativeBins = (cameraBin, bucketCount) => {
        const totalBudget = bucketCount;
        const bitsPerBin = [];

        // Assign weights to bins based on pre-calculated distance lookup
        for (let i = 0; i < numBins; ++i) {
            const distFromCamera = Math.abs(i - cameraBin);
            bitsPerBin[i] = weightByDistance[distFromCamera];
        }

        // Normalize to fit within budget
        const totalWeight = bitsPerBin.reduce((a, b) => a + b, 0);
        let accumulated = 0;

        for (let i = 0; i < numBins; ++i) {
            binDivider[i] = Math.max(1, Math.floor((bitsPerBin[i] / totalWeight) * totalBudget));
            binBase[i] = accumulated;
            accumulated += binDivider[i];
        }

        // Adjust last bin to fit exactly
        if (accumulated > bucketCount) {
            const excess = accumulated - bucketCount;
            binDivider[numBins - 1] = Math.max(1, binDivider[numBins - 1] - excess);
        }

        // Add safety entry for edge case where bin >= numBins due to floating point
        binBase[numBins] = binBase[numBins - 1] + binDivider[numBins - 1];
        binDivider[numBins] = 0;
    };

    // Common sort key evaluation logic
    const evaluateSortKeysCommon = (sortParams, minDist, range, distances, countBuffer, centersData, processSplatFn) => {
        const { ids, lineStarts, padding, intervals, textureSize } = centersData;

        // pre-calculate inverse bin range
        const invBinRange = numBins / range;

        // loop over all the splat placements
        for (let paramIdx = 0; paramIdx < sortParams.length; paramIdx++) {
            const params = sortParams[paramIdx];

            // source centers
            const id = ids[paramIdx];
            const centers = centersMap.get(id);
            if (!centers) {
                console.error('UnifiedSortWorker: No centers found for id', id);
            }

            // start index in unified buffer
            let targetIndex = lineStarts[paramIdx] * textureSize;

            // Use provided intervals or process all centers
            const intervalsArray = intervals[paramIdx].length > 0 ? intervals[paramIdx] : [0, centers.length / 3];

            // loop over all intervals of centers
            for (let i = 0; i < intervalsArray.length; i += 2) {
                const intervalStart = intervalsArray[i] * 3;
                const intervalEnd = intervalsArray[i + 1] * 3;

                // Process each center in this interval using the provided function
                targetIndex = processSplatFn(centers, params, intervalStart, intervalEnd, targetIndex,
                    invBinRange, minDist, range, distances, countBuffer);
            }

            // add padding, to make sure the whole buffer (including padding) is sorted
            const pad = padding[paramIdx];
            countBuffer[0] += pad;

            // set distance values for padding positions to prevent garbage data
            distances.fill(0, targetIndex, targetIndex + pad);
            targetIndex += pad;
        }
    };

    const evaluateSortKeysLinear = (sortParams, minDist, range, distances, countBuffer, centersData) => {
        evaluateSortKeysCommon(sortParams, minDist, range, distances, countBuffer, centersData,
            (centers, params, intervalStart, intervalEnd, targetIndex, invBinRange, minDist, range, distances, countBuffer) => {
                // camera related params
                const { transformedDirection, offset, scale } = params;
                const dx = transformedDirection.x;
                const dy = transformedDirection.y;
                const dz = transformedDirection.z;

                // pre-calculate camera related constants
                const sdx = dx * scale;
                const sdy = dy * scale;
                const sdz = dz * scale;
                const add = offset - minDist;

                // Process each center in this interval
                for (let srcIndex = intervalStart; srcIndex < intervalEnd; srcIndex += 3) {
                    const x = centers[srcIndex];
                    const y = centers[srcIndex + 1];
                    const z = centers[srcIndex + 2];

                    const dist = x * sdx + y * sdy + z * sdz + add;

                    // Bin-based mapping
                    const d = dist * invBinRange;
                    const bin = d >>> 0;
                    const sortKey = (binBase[bin] + binDivider[bin] * (d - bin)) >>> 0;

                    distances[targetIndex++] = sortKey;
                    countBuffer[sortKey]++;
                }

                return targetIndex;
            });
    };

    const evaluateSortKeysRadial = (sortParams, minDist, range, distances, countBuffer, centersData) => {
        evaluateSortKeysCommon(sortParams, minDist, range, distances, countBuffer, centersData,
            (centers, params, intervalStart, intervalEnd, targetIndex, invBinRange, minDist, range, distances, countBuffer) => {
                // camera related params
                const { transformedPosition, scale } = params;

                // camera position in local space
                const cx = transformedPosition.x;
                const cy = transformedPosition.y;
                const cz = transformedPosition.z;

                // Process each center in this interval
                for (let srcIndex = intervalStart; srcIndex < intervalEnd; srcIndex += 3) {
                    const dx = centers[srcIndex] - cx;
                    const dy = centers[srcIndex + 1] - cy;
                    const dz = centers[srcIndex + 2] - cz;

                    const distSq = dx * dx + dy * dy + dz * dz;
                    // World-space radial distance from camera
                    const dist = Math.sqrt(distSq) * scale;

                    // Bin-based mapping (normalize by minDist for binning)
                    // Invert distance so far objects get small keys (rendered first, back-to-front)
                    const invertedDist = range - dist;
                    const d = invertedDist * invBinRange;
                    const bin = d >>> 0;
                    const sortKey = (binBase[bin] + binDivider[bin] * (d - bin)) >>> 0;

                    distances[targetIndex++] = sortKey;
                    countBuffer[sortKey]++;
                }

                return targetIndex;
            });
    };

    const countingSort = (bucketCount, countBuffer, numVertices, distances, order) => {

        // accumulate counts
        for (let i = 1; i < bucketCount; i++) {
            countBuffer[i] += countBuffer[i - 1];
        }

        // build output array
        for (let i = 0; i < numVertices; i++) {
            const distance = distances[i];
            const destIndex = --countBuffer[distance];
            order[destIndex] = i;
        }
    };

    // compute min/max effective distance using 8-corner local AABB projection per splat
    const computeEffectiveDistanceRangeLinear = (sortParams) => {
        let minDist = Infinity;
        let maxDist = -Infinity;

        for (let paramIdx = 0; paramIdx < sortParams.length; paramIdx++) {
            const params = sortParams[paramIdx];
            const { transformedDirection, offset, scale, aabbMin, aabbMax } = params;
            const dx = transformedDirection.x;
            const dy = transformedDirection.y;
            const dz = transformedDirection.z;

            // For a direction d and AABB [min,max], the min/max of dot(d, p) over the box
            // is obtained by picking min/max per component based on the sign of d
            const pxMin = dx >= 0 ? aabbMin[0] : aabbMax[0];
            const pyMin = dy >= 0 ? aabbMin[1] : aabbMax[1];
            const pzMin = dz >= 0 ? aabbMin[2] : aabbMax[2];
            const pxMax = dx >= 0 ? aabbMax[0] : aabbMin[0];
            const pyMax = dy >= 0 ? aabbMax[1] : aabbMin[1];
            const pzMax = dz >= 0 ? aabbMax[2] : aabbMin[2];

            const dMin = pxMin * dx + pyMin * dy + pzMin * dz;
            const dMax = pxMax * dx + pyMax * dy + pzMax * dz;

            const eMin = dMin * scale + offset;
            const eMax = dMax * scale + offset;

            // handle negative scale by swapping
            const localMin = Math.min(eMin, eMax);
            const localMax = Math.max(eMin, eMax);

            if (localMin < minDist) minDist = localMin;
            if (localMax > maxDist) maxDist = localMax;
        }

        if (minDist === Infinity) {
            minDist = 0;
            maxDist = 0;
        }
        return { minDist, maxDist };
    };

    // compute min/max radial distance from camera to AABB corners (for radial sort)
    const computeEffectiveDistanceRangeRadial = (sortParams) => {
        let maxDist = -Infinity;

        for (let paramIdx = 0; paramIdx < sortParams.length; paramIdx++) {
            const params = sortParams[paramIdx];
            const { transformedPosition, scale, aabbMin, aabbMax } = params;
            const cx = transformedPosition.x;
            const cy = transformedPosition.y;
            const cz = transformedPosition.z;

            // Check all 8 corners of the AABB for max radial distance
            for (let i = 0; i < 8; i++) {
                const px = (i & 1) ? aabbMax[0] : aabbMin[0];
                const py = (i & 2) ? aabbMax[1] : aabbMin[1];
                const pz = (i & 4) ? aabbMax[2] : aabbMin[2];

                const dx = px - cx;
                const dy = py - cy;
                const dz = pz - cz;

                const distSq = dx * dx + dy * dy + dz * dz;
                const dist = Math.sqrt(distSq) * scale;

                if (dist > maxDist) maxDist = dist;
            }
        }

        // For radial sort, minDist is always 0 (camera is the origin of radial distances)
        const minDist = 0;
        if (maxDist < 0) {
            maxDist = 0;
        }
        return { minDist, maxDist };
    };

    const sort = (sortParams, order, centersData) => {

        // distance bounds from AABB projections per splat
        const { minDist, maxDist } = _radialSort ?
            computeEffectiveDistanceRangeRadial(sortParams) :
            computeEffectiveDistanceRangeLinear(sortParams);

        const numVertices = centersData.totalUsedPixels;

        // calculate number of bits needed to store sorting result
        const compareBits = Math.max(10, Math.min(20, Math.round(Math.log2(numVertices / 4))));

        const bucketCount = 2 ** compareBits + 1;

        // create distance buffer
        if (distances?.length !== numVertices) {
            distances = new Uint32Array(numVertices);
        }

        if (!countBuffer || countBuffer.length !== bucketCount) {
            countBuffer = new Uint32Array(bucketCount);
        } else {
            countBuffer.fill(0);
        }

        const range = maxDist - minDist;

        // Set up camera-relative bin weighting for near-camera precision
        let cameraBin;
        if (_radialSort) {
            // For radial sort with inverted distances, camera (dist=0) maps to the last bin
            cameraBin = numBins - 1;
        } else {
            // For linear sort, calculate where camera falls in the projected distance range
            const cameraOffsetFromRangeStart = 0 - minDist;
            const cameraBinFloat = (cameraOffsetFromRangeStart / range) * numBins;
            cameraBin = Math.max(0, Math.min(numBins - 1, Math.floor(cameraBinFloat)));
        }

        setupCameraRelativeBins(cameraBin, bucketCount);

        if (_radialSort) {
            evaluateSortKeysRadial(sortParams, minDist, range, distances, countBuffer, centersData);
        } else {
            evaluateSortKeysLinear(sortParams, minDist, range, distances, countBuffer, centersData);
        }

        countingSort(bucketCount, countBuffer, numVertices, distances, order);

        const count = numVertices;

        // send results
        const transferList = [order.buffer];
        const response = {
            order: order.buffer,
            count,
            version: centersData.version
        };

        myself.postMessage(response, transferList);
    };

    myself.addEventListener('message', (message) => {
        const msgData = message.data ?? message;

        switch (msgData.command) {

            // add centers to map
            case 'addCenters': {
                centersMap.set(msgData.id, new Float32Array(msgData.centers));
                break;
            }

            // remove centers from map
            case 'removeCenters': {
                centersMap.delete(msgData.id);
                break;
            }

            // sort
            case 'sort': {
                _radialSort = msgData.radialSorting || false;
                const order = new Uint32Array(msgData.order);
                sort(msgData.sortParams, order, centersData);
                break;
            }

            // intervals
            case 'intervals': {
                centersData = msgData;
                break;
            }
        }
    });
}

export { UnifiedSortWorker };
