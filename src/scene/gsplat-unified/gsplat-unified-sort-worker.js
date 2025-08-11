function UnifiedSortWorker() {

    const myself = (typeof self !== 'undefined' && self) || (require('node:worker_threads').parentPort);

    // let chunks;
    // let sortSplatCount;

    // cache of centers for each splat id
    const centersMap = new Map();
    let centersData;

    // const boundMin = { x: 0, y: 0, z: 0 };
    // const boundMax = { x: 0, y: 0, z: 0 };

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

    const evaluateSortKeys = (sortParams, minDist, divider, distances, countBuffer, centersData) => {

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
            const scaledDivider = scale * divider;
            const offsetMinusMinDistTimesDivider = (offset - minDist) * divider;

            // source centers
            const id = ids[paramIdx];
            const centers = centersMap.get(id);

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

                    const dotProduct = x * dx + y * dy + z * dz;
                    const sortKey = Math.floor(dotProduct * scaledDivider + offsetMinusMinDistTimesDivider);

                    distances[targetIndex++] = sortKey;
                    countBuffer[sortKey]++;
                }
            }

            // add padding, to make sure the whole buffer (including padding) is sorted
            countBuffer[0] += padding[paramIdx];
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

    const sort = (sortParams, order, centersData) => {

        // // calc min/max distance using bound
        // let minDist;
        // let maxDist;
        // for (let i = 0; i < 8; ++i) {
        //     const x = (i & 1 ? boundMin.x : boundMax.x);
        //     const y = (i & 2 ? boundMin.y : boundMax.y);
        //     const z = (i & 4 ? boundMin.z : boundMax.z);
        //     const d = x * dx + y * dy + z * dz;
        //     if (i === 0) {
        //         minDist = maxDist = d;
        //     } else {
        //         minDist = Math.min(minDist, d);
        //         maxDist = Math.max(maxDist, d);
        //     }
        // }

        // const minDist = -1000;
        // const maxDist = 1000;
        const minDist = -1872;
        const maxDist = 1891;

        // const minDist = -50;
        // const maxDist = 10;


        const textureSize = centersData.textureSize;
        const numVertices = textureSize * textureSize;

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

        if (range < 1e-6) {
            // all points are at the same distance
            for (let i = 0; i < numVertices; ++i) {
                distances[i] = 0;
                countBuffer[0]++;
            }
        } else {
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


            const divider = (range < 1e-6) ? 0 : 1 / range * (2 ** compareBits);

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


            evaluateSortKeys(sortParams, minDist, divider, distances, countBuffer, centersData);

            countingSort(bucketCount, countBuffer, numVertices, distances, order);


        }

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

        // if (msgData.centers) {
        //     centers = new Float32Array(msgData.centers);

        //     // if (msgData.chunks) {
        //     //     const chunksSrc = new Float32Array(msgData.chunks);
        //     //     // reuse chunks memory, but we only need 4 floats per chunk
        //     //     chunks = new Float32Array(msgData.chunks, 0, chunksSrc.length * 4 / 6);

        //     //     boundMin.x = chunksSrc[0];
        //     //     boundMin.y = chunksSrc[1];
        //     //     boundMin.z = chunksSrc[2];
        //     //     boundMax.x = chunksSrc[3];
        //     //     boundMax.y = chunksSrc[4];
        //     //     boundMax.z = chunksSrc[5];

        //     //     // convert chunk min/max to center/radius
        //     //     for (let i = 0; i < chunksSrc.length / 6; ++i) {
        //     //         const mx = chunksSrc[i * 6 + 0];
        //     //         const my = chunksSrc[i * 6 + 1];
        //     //         const mz = chunksSrc[i * 6 + 2];
        //     //         const Mx = chunksSrc[i * 6 + 3];
        //     //         const My = chunksSrc[i * 6 + 4];
        //     //         const Mz = chunksSrc[i * 6 + 5];

        //     //         chunks[i * 4 + 0] = (mx + Mx) * 0.5;
        //     //         chunks[i * 4 + 1] = (my + My) * 0.5;
        //     //         chunks[i * 4 + 2] = (mz + Mz) * 0.5;
        //     //         chunks[i * 4 + 3] = Math.sqrt((Mx - mx) ** 2 + (My - my) ** 2 + (Mz - mz) ** 2) * 0.5;

        //     //         if (mx < boundMin.x) boundMin.x = mx;
        //     //         if (my < boundMin.y) boundMin.y = my;
        //     //         if (mz < boundMin.z) boundMin.z = mz;
        //     //         if (Mx > boundMax.x) boundMax.x = Mx;
        //     //         if (My > boundMax.y) boundMax.y = My;
        //     //         if (Mz > boundMax.z) boundMax.z = Mz;
        //     //     }
        //     // } else {
        //     //     // chunk bounds weren't provided, so calculate them from the centers
        //     //     const numVertices = centers.length / 3;
        //     //     const numChunks = Math.ceil(numVertices / 256);

        //     //     // allocate storage for one bounding sphere per 256-vertex chunk
        //     //     chunks = new Float32Array(numChunks * 4);

        //     //     boundMin.x = boundMin.y = boundMin.z = Infinity;
        //     //     boundMax.x = boundMax.y = boundMax.z = -Infinity;

        //     //     // calculate bounds
        //     //     let mx, my, mz, Mx, My, Mz;
        //     //     for (let c = 0; c < numChunks; ++c) {
        //     //         mx = my = mz = Infinity;
        //     //         Mx = My = Mz = -Infinity;

        //     //         const start = c * 256;
        //     //         const end = Math.min(numVertices, (c + 1) * 256);
        //     //         for (let i = start; i < end; ++i) {
        //     //             const x = centers[i * 3 + 0];
        //     //             const y = centers[i * 3 + 1];
        //     //             const z = centers[i * 3 + 2];

        //     //             const validX = Number.isFinite(x);
        //     //             const validY = Number.isFinite(y);
        //     //             const validZ = Number.isFinite(z);

        //     //             if (!validX) centers[i * 3 + 0] = 0;
        //     //             if (!validY) centers[i * 3 + 1] = 0;
        //     //             if (!validZ) centers[i * 3 + 2] = 0;
        //     //             if (!validX || !validY || !validZ) {
        //     //                 continue;
        //     //             }

        //     //             if (x < mx) mx = x; else if (x > Mx) Mx = x;
        //     //             if (y < my) my = y; else if (y > My) My = y;
        //     //             if (z < mz) mz = z; else if (z > Mz) Mz = z;

        //     //             if (x < boundMin.x) boundMin.x = x; else if (x > boundMax.x) boundMax.x = x;
        //     //             if (y < boundMin.y) boundMin.y = y; else if (y > boundMax.y) boundMax.y = y;
        //     //             if (z < boundMin.z) boundMin.z = z; else if (z > boundMax.z) boundMax.z = z;
        //     //         }

        //     //         // calculate chunk center and radius from bound min/max
        //     //         chunks[c * 4 + 0] = (mx + Mx) * 0.5;
        //     //         chunks[c * 4 + 1] = (my + My) * 0.5;
        //     //         chunks[c * 4 + 2] = (mz + Mz) * 0.5;
        //     //         chunks[c * 4 + 3] = Math.sqrt((Mx - mx) ** 2 + (My - my) ** 2 + (Mz - mz) ** 2) * 0.5;
        //     //     }
        //     // }
        // }
    });
}

export { UnifiedSortWorker };
