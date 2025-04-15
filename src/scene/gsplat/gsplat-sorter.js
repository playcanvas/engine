import { EventHandler } from '../../core/event-handler.js';
import { TEXTURELOCK_READ } from '../../platform/graphics/constants.js';

// sort blind set of data
function SortWorker() {
    let order;
    let centers;
    let chunks;
    let mapping;
    let cameraPosition;
    let cameraDirection;

    let forceUpdate = false;

    const lastCameraPosition = { x: 0, y: 0, z: 0 };
    const lastCameraDirection = { x: 0, y: 0, z: 0 };

    const boundMin = { x: 0, y: 0, z: 0 };
    const boundMax = { x: 0, y: 0, z: 0 };

    let distances;
    let countBuffer;

    // could be increased, but this seems a good compromise between stability and performance
    const numBins = 32;
    const binCount = new Array(numBins).fill(0);
    const binBase = new Array(numBins).fill(0);
    const binDivider = new Array(numBins).fill(0);

    const binarySearch = (m, n, compare_fn) => {
        while (m <= n) {
            const k = (n + m) >> 1;
            const cmp = compare_fn(k);
            if (cmp > 0) {
                m = k + 1;
            } else if (cmp < 0) {
                n = k - 1;
            } else {
                return k;
            }
        }
        return ~m;
    };

    const update = () => {
        if (!order || !centers || centers.length === 0 || !cameraPosition || !cameraDirection) return;

        const px = cameraPosition.x;
        const py = cameraPosition.y;
        const pz = cameraPosition.z;
        const dx = cameraDirection.x;
        const dy = cameraDirection.y;
        const dz = cameraDirection.z;

        const epsilon = 0.001;

        if (!forceUpdate &&
            Math.abs(px - lastCameraPosition.x) < epsilon &&
            Math.abs(py - lastCameraPosition.y) < epsilon &&
            Math.abs(pz - lastCameraPosition.z) < epsilon &&
            Math.abs(dx - lastCameraDirection.x) < epsilon &&
            Math.abs(dy - lastCameraDirection.y) < epsilon &&
            Math.abs(dz - lastCameraDirection.z) < epsilon) {
            return;
        }

        forceUpdate = false;

        lastCameraPosition.x = px;
        lastCameraPosition.y = py;
        lastCameraPosition.z = pz;
        lastCameraDirection.x = dx;
        lastCameraDirection.y = dy;
        lastCameraDirection.z = dz;

        // calc min/max distance using bound
        let minDist;
        let maxDist;
        for (let i = 0; i < 8; ++i) {
            const x = (i & 1 ? boundMin.x : boundMax.x);
            const y = (i & 2 ? boundMin.y : boundMax.y);
            const z = (i & 4 ? boundMin.z : boundMax.z);
            const d = x * dx + y * dy + z * dz;
            if (i === 0) {
                minDist = maxDist = d;
            } else {
                minDist = Math.min(minDist, d);
                maxDist = Math.max(maxDist, d);
            }
        }

        const numVertices = centers.length / 3;

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
        } else if (chunks) {
            // handle sort with compressed chunks
            const numChunks = chunks.length / 6;

            // calculate a histogram of chunk distances to camera
            binCount.fill(0);
            for (let i = 0; i < numChunks; ++i) {
                const x = chunks[i * 6 + 0];
                const y = chunks[i * 6 + 1];
                const z = chunks[i * 6 + 2];
                const r = chunks[i * 6 + 3];
                const d = x * dx + y * dy + z * dz - minDist;

                const binMin = Math.max(0, Math.floor((d - r) * numBins / range));
                const binMax = Math.min(numBins, Math.ceil((d + r) * numBins / range));

                for (let j = binMin; j < binMax; ++j) {
                    binCount[j]++;
                }
            }

            // count total number of histogram bin entries
            const binTotal = binCount.reduce((a, b) => a + b, 0);

            // calculate per-bin base and divider
            for (let i = 0; i < numBins; ++i) {
                binDivider[i] = (binCount[i] / binTotal * bucketCount) >>> 0;
            }
            for (let i = 0; i < numBins; ++i) {
                binBase[i] = i === 0 ? 0 : binBase[i - 1] + binDivider[i - 1];
            }

            // generate per vertex distance key using histogram to distribute bits
            const binRange = range / numBins;
            let ii = 0;
            for (let i = 0; i < numVertices; ++i) {
                const x = centers[ii++];
                const y = centers[ii++];
                const z = centers[ii++];
                const d = (x * dx + y * dy + z * dz - minDist) / binRange;
                const bin = d >>> 0;
                const sortKey = (binBase[bin] + binDivider[bin] * (d - bin)) >>> 0;

                distances[i] = sortKey;

                // count occurrences of each distance
                countBuffer[sortKey]++;
            }
        } else {
            // generate per vertex distance to camera for uncompressed data
            const divider = (2 ** compareBits) / range;
            let ii = 0;
            for (let i = 0; i < numVertices; ++i) {
                const x = centers[ii++];
                const y = centers[ii++];
                const z = centers[ii++];

                const d = (x * dx + y * dy + z * dz - minDist) * divider;
                const sortKey = d >>> 0;

                distances[i] = sortKey;

                // count occurrences of each distance
                countBuffer[sortKey]++;
            }
        }

        // Change countBuffer[i] so that it contains actual position of this digit in outputArray
        for (let i = 1; i < bucketCount; i++) {
            countBuffer[i] += countBuffer[i - 1];
        }

        // Build the output array
        for (let i = 0; i < numVertices; i++) {
            const distance = distances[i];
            const destIndex = --countBuffer[distance];
            order[destIndex] = i;
        }

        // Find splat with distance 0 to limit rendering behind the camera
        const cameraDist = px * dx + py * dy + pz * dz;
        const dist = (i) => {
            let o = order[i] * 3;
            return centers[o++] * dx + centers[o++] * dy + centers[o] * dz - cameraDist;
        };
        const findZero = () => {
            const result = binarySearch(0, numVertices - 1, i => -dist(i));
            return Math.min(numVertices, Math.abs(result));
        };

        const count = dist(numVertices - 1) >= 0 ? findZero() : numVertices;

        // apply mapping
        if (mapping) {
            for (let i = 0; i < numVertices; ++i) {
                order[i] = mapping[order[i]];
            }
        }

        // send results
        self.postMessage({
            order: order.buffer,
            count
        }, [order.buffer]);

        order = null;
    };

    self.onmessage = (message) => {
        if (message.data.order) {
            order = new Uint32Array(message.data.order);
        }
        if (message.data.centers) {
            centers = new Float32Array(message.data.centers);
            forceUpdate = true;

            // calculate bounds
            let initialized = false;
            const numVertices = centers.length / 3;
            for (let i = 0; i < numVertices; ++i) {
                let x = centers[i * 3 + 0];
                let y = centers[i * 3 + 1];
                let z = centers[i * 3 + 2];

                if (isNaN(x)) {
                    x = centers[i * 3 + 0] = 0;
                }
                if (isNaN(y)) {
                    y = centers[i * 3 + 1] = 0;
                }
                if (isNaN(z)) {
                    z = centers[i * 3 + 2] = 0;
                }

                if (!initialized) {
                    initialized = true;
                    boundMin.x = boundMax.x = x;
                    boundMin.y = boundMax.y = y;
                    boundMin.z = boundMax.z = z;
                } else {
                    boundMin.x = Math.min(boundMin.x, x);
                    boundMax.x = Math.max(boundMax.x, x);
                    boundMin.y = Math.min(boundMin.y, y);
                    boundMax.y = Math.max(boundMax.y, y);
                    boundMin.z = Math.min(boundMin.z, z);
                    boundMax.z = Math.max(boundMax.z, z);
                }
            }

            if (!initialized) {
                boundMin.x = boundMax.x = boundMin.y = boundMax.y = boundMin.z = boundMax.z = 0;
            }
        }
        if (message.data.chunks) {
            chunks = new Float32Array(message.data.chunks);
            forceUpdate = true;

            // convert chunk min/max to center/radius
            for (let i = 0; i < chunks.length / 6; ++i) {
                const mx = chunks[i * 6 + 0];
                const my = chunks[i * 6 + 1];
                const mz = chunks[i * 6 + 2];
                const Mx = chunks[i * 6 + 3];
                const My = chunks[i * 6 + 4];
                const Mz = chunks[i * 6 + 5];

                chunks[i * 6 + 0] = (mx + Mx) * 0.5;
                chunks[i * 6 + 1] = (my + My) * 0.5;
                chunks[i * 6 + 2] = (mz + Mz) * 0.5;
                chunks[i * 6 + 3] = Math.sqrt((Mx - mx) ** 2 + (My - my) ** 2 + (Mz - mz) ** 2) * 0.5;
            }
        }
        if (message.data.hasOwnProperty('mapping')) {
            mapping = message.data.mapping ? new Uint32Array(message.data.mapping) : null;
            forceUpdate = true;
        }
        if (message.data.cameraPosition) cameraPosition = message.data.cameraPosition;
        if (message.data.cameraDirection) cameraDirection = message.data.cameraDirection;

        update();
    };
}

class GSplatSorter extends EventHandler {
    worker;

    orderTexture;

    centers;

    constructor() {
        super();

        this.worker = new Worker(URL.createObjectURL(new Blob([`(${SortWorker.toString()})()`], {
            type: 'application/javascript'
        })));

        this.worker.onmessage = (message) => {
            const newOrder = message.data.order;
            const oldOrder = this.orderTexture._levels[0].buffer;

            // send vertex storage to worker to start the next frame
            this.worker.postMessage({
                order: oldOrder
            }, [oldOrder]);

            // write the new order data to gpu texture memory
            this.orderTexture._levels[0] = new Uint32Array(newOrder);
            this.orderTexture.upload();

            // set new data directly on texture
            this.fire('updated', message.data.count);
        };
    }

    destroy() {
        this.worker.terminate();
        this.worker = null;
    }

    init(orderTexture, centers, chunks) {
        this.orderTexture = orderTexture;
        this.centers = centers.slice();

        // get the texture's storage buffer and make a copy
        const orderBuffer = this.orderTexture.lock({
            mode: TEXTURELOCK_READ
        }).slice();
        this.orderTexture.unlock();

        // initialize order data
        for (let i = 0; i < orderBuffer.length; ++i) {
            orderBuffer[i] = i;
        }

        const obj = {
            order: orderBuffer.buffer,
            centers: centers.buffer,
            chunks: chunks?.buffer
        };

        const transfer = [orderBuffer.buffer, centers.buffer].concat(chunks ? [chunks.buffer] : []);

        // send the initial buffer to worker
        this.worker.postMessage(obj, transfer);
    }

    setMapping(mapping) {
        if (mapping) {
            // create new centers array
            const centers = new Float32Array(mapping.length * 3);
            for (let i = 0; i < mapping.length; ++i) {
                const src = mapping[i] * 3;
                const dst = i * 3;
                centers[dst + 0] = this.centers[src + 0];
                centers[dst + 1] = this.centers[src + 1];
                centers[dst + 2] = this.centers[src + 2];
            }

            // update worker with new centers and mapping for the subset of splats
            this.worker.postMessage({
                centers: centers.buffer,
                mapping: mapping.buffer
            }, [centers.buffer, mapping.buffer]);
        } else {
            // restore original centers
            const centers = this.centers.slice();
            this.worker.postMessage({
                centers: centers.buffer,
                mapping: null
            }, [centers.buffer]);
        }
    }

    setCamera(pos, dir) {
        this.worker.postMessage({
            cameraPosition: { x: pos.x, y: pos.y, z: pos.z },
            cameraDirection: { x: dir.x, y: dir.y, z: dir.z }
        });
    }
}

export { GSplatSorter };
