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
        } else {
            // use chunks to calculate rough histogram of splats per distance
            const numChunks = chunks.length / 4;

            binCount.fill(0);
            for (let i = 0; i < numChunks; ++i) {
                const x = chunks[i * 4 + 0];
                const y = chunks[i * 4 + 1];
                const z = chunks[i * 4 + 2];
                const r = chunks[i * 4 + 3];
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

            if (message.data.chunks) {
                const chunksSrc = new Float32Array(message.data.chunks);
                // reuse chunks memory, but we only need 4 floats per chunk
                chunks = new Float32Array(message.data.chunks, 0, chunksSrc.length * 4 / 6);

                boundMin.x = chunksSrc[0];
                boundMin.y = chunksSrc[1];
                boundMin.z = chunksSrc[2];
                boundMax.x = chunksSrc[3];
                boundMax.y = chunksSrc[4];
                boundMax.z = chunksSrc[5];

                // convert chunk min/max to center/radius
                for (let i = 0; i < chunksSrc.length / 6; ++i) {
                    const mx = chunksSrc[i * 6 + 0];
                    const my = chunksSrc[i * 6 + 1];
                    const mz = chunksSrc[i * 6 + 2];
                    const Mx = chunksSrc[i * 6 + 3];
                    const My = chunksSrc[i * 6 + 4];
                    const Mz = chunksSrc[i * 6 + 5];

                    chunks[i * 4 + 0] = (mx + Mx) * 0.5;
                    chunks[i * 4 + 1] = (my + My) * 0.5;
                    chunks[i * 4 + 2] = (mz + Mz) * 0.5;
                    chunks[i * 4 + 3] = Math.sqrt((Mx - mx) ** 2 + (My - my) ** 2 + (Mz - mz) ** 2) * 0.5;

                    if (mx < boundMin.x) boundMin.x = mx;
                    if (my < boundMin.y) boundMin.y = my;
                    if (mz < boundMin.z) boundMin.z = mz;
                    if (Mx > boundMax.x) boundMax.x = Mx;
                    if (My > boundMax.y) boundMax.y = My;
                    if (Mz > boundMax.z) boundMax.z = Mz;
                }
            } else {
                // chunk bounds weren't provided, so calculate them from the centers
                const numVertices = centers.length / 3;
                const numChunks = Math.ceil(numVertices / 256);

                // allocate storage for one bounding sphere per 256-vertex chunk
                chunks = new Float32Array(numChunks * 4);

                boundMin.x = boundMin.y = boundMin.z = Infinity;
                boundMax.x = boundMax.y = boundMax.z = -Infinity;

                // calculate bounds
                let mx, my, mz, Mx, My, Mz;
                for (let c = 0; c < numChunks; ++c) {
                    mx = my = mz = Infinity;
                    Mx = My = Mz = -Infinity;

                    const start = c * 256;
                    const end = Math.min(numVertices, (c + 1) * 256);
                    for (let i = start; i < end; ++i) {
                        const x = centers[i * 3 + 0];
                        const y = centers[i * 3 + 1];
                        const z = centers[i * 3 + 2];

                        const validX = Number.isFinite(x);
                        const validY = Number.isFinite(y);
                        const validZ = Number.isFinite(z);

                        if (!validX) centers[i * 3 + 0] = 0;
                        if (!validY) centers[i * 3 + 1] = 0;
                        if (!validZ) centers[i * 3 + 2] = 0;
                        if (!validX || !validY || !validZ) {
                            continue;
                        }

                        if (x < mx) mx = x; else if (x > Mx) Mx = x;
                        if (y < my) my = y; else if (y > My) My = y;
                        if (z < mz) mz = z; else if (z > Mz) Mz = z;

                        if (x < boundMin.x) boundMin.x = x; else if (x > boundMax.x) boundMax.x = x;
                        if (y < boundMin.y) boundMin.y = y; else if (y > boundMax.y) boundMax.y = y;
                        if (z < boundMin.z) boundMin.z = z; else if (z > boundMax.z) boundMax.z = z;
                    }

                    // calculate chunk center and radius from bound min/max
                    chunks[c * 4 + 0] = (mx + Mx) * 0.5;
                    chunks[c * 4 + 1] = (my + My) * 0.5;
                    chunks[c * 4 + 2] = (mz + Mz) * 0.5;
                    chunks[c * 4 + 3] = Math.sqrt((Mx - mx) ** 2 + (My - my) ** 2 + (Mz - mz) ** 2) * 0.5;
                }
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
