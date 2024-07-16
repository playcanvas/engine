import { EventHandler } from "../../core/event-handler.js";
import { TEXTURELOCK_READ } from "../../platform/graphics/constants.js";

// sort blind set of data
function SortWorker() {

    // number of bits used to store the distance in integer array. Smaller number gives it a smaller
    // precision but faster sorting. Could be dynamic for less precise sorting.
    // 16bit seems plenty of large scenes (train), 10bits is enough for sled.
    const compareBits = 16;

    // number of buckets for count sorting to represent each unique distance using compareBits bits
    const bucketCount = (2 ** compareBits) + 1;

    let order;
    let centers;
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
        if (!order || !centers || !cameraPosition || !cameraDirection) return;

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

        // create distance buffer
        const numVertices = centers.length / 3;
        if (distances?.length !== numVertices) {
            distances = new Uint32Array(numVertices);
        }

        // calc min/max distance using bound
        let minDist;
        let maxDist;
        for (let i = 0; i < 8; ++i) {
            const x = (i & 1 ? boundMin.x : boundMax.x) - px;
            const y = (i & 2 ? boundMin.y : boundMax.y) - py;
            const z = (i & 4 ? boundMin.z : boundMax.z) - pz;
            const d = x * dx + y * dy + z * dz;
            if (i === 0) {
                minDist = maxDist = d;
            } else {
                minDist = Math.min(minDist, d);
                maxDist = Math.max(maxDist, d);
            }
        }

        if (!countBuffer)
            countBuffer = new Uint32Array(bucketCount);

        for (let i = 0; i < bucketCount; i++)
            countBuffer[i] = 0;

        // generate per vertex distance to camera
        const range = maxDist - minDist;
        const divider = 1 / range * (2 ** compareBits);
        for (let i = 0; i < numVertices; ++i) {
            const istride = i * 3;
            const x = centers[istride + 0] - px;
            const y = centers[istride + 1] - py;
            const z = centers[istride + 2] - pz;
            const d = x * dx + y * dy + z * dz;
            const sortKey = Math.floor((d - minDist) * divider);

            distances[i] = sortKey;

            // count occurrences of each distance
            countBuffer[sortKey]++;
        }

        // Change countBuffer[i] so that it contains actual position of this digit in outputArray
        for (let i = 1; i < bucketCount; i++)
            countBuffer[i] += countBuffer[i - 1];

        // Build the output array
        for (let i = 0; i < numVertices; i++) {
            const distance = distances[i];
            const destIndex = --countBuffer[distance];
            order[destIndex] = i;
        }

        // find splat with distance 0 to limit rendering behind the camera
        const dist = i => distances[order[i]] / divider + minDist;
        const findZero = () => {
            const result = binarySearch(0, numVertices - 1, i => -dist(i));
            return Math.min(numVertices, Math.abs(result));
        };

        // apply mapping
        if (mapping) {
            for (let i = 0; i < numVertices; ++i) {
                order[i] = mapping[order[i]];
            }
        }

        // send results
        self.postMessage({
            order: order.buffer,
            count: dist(numVertices - 1) >= 0 ? findZero() : numVertices
        }, [order.buffer]);

        order = null;
    };

    self.onmessage = (message) => {
        if (message.data.order) {
            order = new Uint32Array(message.data.order);
        }
        if (message.data.centers) {
            centers = new Float32Array(message.data.centers);

            // calculate bounds
            boundMin.x = boundMax.x = centers[0];
            boundMin.y = boundMax.y = centers[1];
            boundMin.z = boundMax.z = centers[2];

            const numVertices = centers.length / 3;
            for (let i = 1; i < numVertices; ++i) {
                const x = centers[i * 3 + 0];
                const y = centers[i * 3 + 1];
                const z = centers[i * 3 + 2];

                boundMin.x = Math.min(boundMin.x, x);
                boundMin.y = Math.min(boundMin.y, y);
                boundMin.z = Math.min(boundMin.z, z);

                boundMax.x = Math.max(boundMax.x, x);
                boundMax.y = Math.max(boundMax.y, y);
                boundMax.z = Math.max(boundMax.z, z);
            }
            forceUpdate = true;
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

    init(orderTexture, centers) {
        this.orderTexture = orderTexture;
        this.centers = centers.slice();

        // get the texture's storage buffer and make a copy
        const orderBuffer = this.orderTexture.lock({
            mode: TEXTURELOCK_READ
        }).buffer.slice();
        this.orderTexture.unlock();

        // send the initial buffer to worker
        this.worker.postMessage({
            order: orderBuffer,
            centers: centers.buffer
        }, [orderBuffer, centers.buffer]);
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
