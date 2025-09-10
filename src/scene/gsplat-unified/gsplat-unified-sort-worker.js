function UnifiedSortWorker() {

    const myself = (typeof self !== 'undefined' && self) || (require('node:worker_threads').parentPort);

    // let chunks;
    // let sortSplatCount;

    // cache of centers for each splat id
    const centersMap = new Map();
    let centersData;
    let distances;
    let countBuffer;

    // could be increased, but this seems a good compromise between stability and performance
    // const numBins = 32;
    // const binCount = new Array(numBins).fill(0);
    // const binBase = new Array(numBins).fill(0);
    // const binDivider = new Array(numBins).fill(0);

    // const binarySearch = (m, n, compare_fn) => {
    //     while (m <= n) {
    //         const k = (n + m) >> 1;
    //         const cmp = compare_fn(k);
    //         if (cmp > 0) {
    //             m = k + 1;
    //         } else if (cmp < 0) {
    //             n = k - 1;
    //         } else {
    //             return k;
    //         }
    //     }
    //     return ~m;
    // };

    const evaluateSortKeys = (sortParams, minDist, divider, distances, countBuffer, centersData, bucketCount) => {
        const { ids, lineStarts, padding, intervals, textureSize } = centersData;

        // loop over all the splat placements
        for (let paramIdx = 0; paramIdx < sortParams.length; paramIdx++) {

            // camera related params
            const params = sortParams[paramIdx];
            const { transformedDirection, offset, scale } = params;
            const dx = transformedDirection.x;
            const dy = transformedDirection.y;
            const dz = transformedDirection.z;

            // pre-calculate camera related constants
            const sdx = dx * scale * divider;
            const sdy = dy * scale * divider;
            const sdz = dz * scale * divider;
            const add = (offset - minDist) * divider;

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

                // Process each center in this interval
                for (let srcIndex = intervalStart; srcIndex < intervalEnd; srcIndex += 3) {
                    const x = centers[srcIndex];
                    const y = centers[srcIndex + 1];
                    const z = centers[srcIndex + 2];

                    const sortKey = Math.floor(x * sdx + y * sdy + z * sdz + add);
                    distances[targetIndex++] = sortKey;
                    countBuffer[sortKey]++;
                }
            }

            // add padding, to make sure the whole buffer (including padding) is sorted
            const pad = padding[paramIdx];
            countBuffer[0] += pad;

            // set distance values for padding positions to prevent garbage data
            distances.fill(0, targetIndex, targetIndex + pad);
            targetIndex += pad;
        }
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
    const computeEffectiveDistanceRange = (sortParams) => {
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

    const sort = (sortParams, order, centersData) => {

        // distance bounds from AABB projections per splat
        const { minDist, maxDist } = computeEffectiveDistanceRange(sortParams);

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

        // // use chunks to calculate rough histogram of splats per distance
        // const numChunks = chunks.length / 4;

        // binCount.fill(0);
        // for (let i = 0; i < numChunks; ++i) {
        //     const x = chunks[i * 4 + 0];
        //     const y = chunks[i * 4 + 1];
        //     const z = chunks[i * 4 + 2];
        //     const r = chunks[i * 4 + 3];
        //     const d = x * dx + y * dy + z * dz - minDist;

        //     const binMin = Math.max(0, Math.floor((d - r) * numBins / range));
        //     const binMax = Math.min(numBins, Math.ceil((d + r) * numBins / range));

        //     for (let j = binMin; j < binMax; ++j) {
        //         binCount[j]++;
        //     }
        // }

        // // count total number of histogram bin entries
        // const binTotal = binCount.reduce((a, b) => a + b, 0);

        // // calculate per-bin base and divider
        // for (let i = 0; i < numBins; ++i) {
        //     binDivider[i] = (binCount[i] / binTotal * bucketCount) >>> 0;
        // }
        // for (let i = 0; i < numBins; ++i) {
        //     binBase[i] = i === 0 ? 0 : binBase[i - 1] + binDivider[i - 1];
        // }

        // // generate per vertex distance key using histogram to distribute bits
        // const binRange = range / numBins;
        // let ii = 0;
        // for (let i = 0; i < numVertices; ++i) {
        //     const x = centers[ii++];
        //     const y = centers[ii++];
        //     const z = centers[ii++];
        //     const d = (x * dx + y * dy + z * dz - minDist) / binRange;
        //     const bin = d >>> 0;
        //     const sortKey = (binBase[bin] + binDivider[bin] * (d - bin)) >>> 0;

        //     distances[i] = sortKey;

        //     // count occurrences of each distance
        //     countBuffer[sortKey]++;
        // }


        const divider = (range < 1e-6) ? 0 : (1 / range) * (2 ** compareBits);

        // for (let i = 0; i < numVertices; ++i) {
        //     const istride = i * 3;
        //     const x = centers[istride + 0] - px;
        //     const y = centers[istride + 1] - py;
        //     const z = centers[istride + 2] - pz;
        //     const d = x * dx + y * dy + z * dz;
        //     const sortKey = Math.floor((d - minDist) * divider);

        //     distances[i] = sortKey;

        //     // count occurrences of each distance
        //     countBuffer[sortKey]++;
        // }


        evaluateSortKeys(sortParams, minDist, divider, distances, countBuffer, centersData, bucketCount);

        countingSort(bucketCount, countBuffer, numVertices, distances, order);


        // // Find splat with distance 0 to limit rendering behind the camera
        // const cameraDist = px * dx + py * dy + pz * dz;
        // const dist = (i) => {
        //     let o = order[i] * 3;
        //     return centers[o++] * dx + centers[o++] * dy + centers[o] * dz - cameraDist;
        // };
        // const findZero = () => {
        //     const result = binarySearch(0, numVertices - 1, i => -dist(i));
        //     return Math.min(numVertices, Math.abs(result));
        // };

        // const count = dist(numVertices - 1) >= 0 ? findZero() : numVertices;
        const count = numVertices;

        console.log('count', count);

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
