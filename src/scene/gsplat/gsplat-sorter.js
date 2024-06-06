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

    let data;
    let centers;
    let cameraPosition;
    let cameraDirection;

    const lastCameraPosition = { x: 0, y: 0, z: 0 };
    const lastCameraDirection = { x: 0, y: 0, z: 0 };

    const boundMin = { x: 0, y: 0, z: 0 };
    const boundMax = { x: 0, y: 0, z: 0 };

    let distances;
    let target;
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
        if (!centers || !data || !cameraPosition || !cameraDirection) return;

        const px = cameraPosition.x;
        const py = cameraPosition.y;
        const pz = cameraPosition.z;
        const dx = cameraDirection.x;
        const dy = cameraDirection.y;
        const dz = cameraDirection.z;

        const epsilon = 0.001;

        if (Math.abs(px - lastCameraPosition.x) < epsilon &&
            Math.abs(py - lastCameraPosition.y) < epsilon &&
            Math.abs(pz - lastCameraPosition.z) < epsilon &&
            Math.abs(dx - lastCameraDirection.x) < epsilon &&
            Math.abs(dy - lastCameraDirection.y) < epsilon &&
            Math.abs(dz - lastCameraDirection.z) < epsilon) {
            return;
        }

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

        if (target?.length !== data.length) {
            target = data.slice();
        }

        // calc min/max distance using bound
        let minDist;
        let maxDist;
        for (let i = 0; i < 8; ++i) {
            const x = i & 1 ? boundMin.x : boundMax.x;
            const y = i & 2 ? boundMin.y : boundMax.y;
            const z = i & 4 ? boundMin.z : boundMax.z;
            const d = (x - px) * dx + (y - py) * dy + (z - pz) * dz;
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
            const d = (centers[istride + 0] - px) * dx +
                      (centers[istride + 1] - py) * dy +
                      (centers[istride + 2] - pz) * dz;
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
            target[destIndex] = i;
        }

        // find splat with distance 0 to limit rendering
        const dist = i => distances[target[i]] / divider + minDist;
        const findZero = () => {
            const result = binarySearch(0, numVertices - 1, i => -dist(i));
            return Math.min(numVertices, Math.abs(result));
        };

        // swap
        const tmp = data;
        data = target;
        target = tmp;

        // send results
        self.postMessage({
            data: data.buffer,
            count: dist(numVertices - 1) >= 0 ? findZero() : numVertices
        }, [data.buffer]);

        data = null;
    };

    self.onmessage = (message) => {
        if (message.data.data) {
            data = new Uint32Array(message.data.data);
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
        }
        if (message.data.cameraPosition) cameraPosition = message.data.cameraPosition;
        if (message.data.cameraDirection) cameraDirection = message.data.cameraDirection;

        update();
    };
}

class GSplatSorter extends EventHandler {
    worker;

    orderTexture;

    constructor() {
        super();

        this.worker = new Worker(URL.createObjectURL(new Blob([`(${SortWorker.toString()})()`], {
            type: 'application/javascript'
        })));

        this.worker.onmessage = (message) => {
            const newData = message.data.data;
            const oldData = this.orderTexture._levels[0].buffer;

            // send vertex storage to worker to start the next frame
            this.worker.postMessage({
                data: oldData
            }, [oldData]);

            // set new data directly on texture
            this.orderTexture._levels[0] = new Uint32Array(newData);
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

        // get the texture's storage buffer and make a copy
        const buf = this.orderTexture.lock({
            mode: TEXTURELOCK_READ
        }).buffer.slice();
        this.orderTexture.unlock();

        // send the initial buffer to worker
        this.worker.postMessage({
            data: buf,
            centers: centers.buffer
        }, [buf, centers.buffer]);
    }

    setCamera(pos, dir) {
        this.worker.postMessage({
            cameraPosition: { x: pos.x, y: pos.y, z: pos.z },
            cameraDirection: { x: dir.x, y: dir.y, z: dir.z }
        });
    }
}

export { GSplatSorter };
