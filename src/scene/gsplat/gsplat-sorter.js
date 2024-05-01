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

    const lastCameraPosition = { x: 0, y: 0, z: 0 };

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
            } else if(cmp < 0) {
                n = k - 1;
            } else {
                return k;
            }
        }
        return ~m;
    }

    const update = () => {
        if (!centers || !data || !cameraPosition) return;

        const px = cameraPosition.x;
        const py = cameraPosition.y;
        const pz = cameraPosition.z;

        const epsilon = 0.001;

        if (Math.abs(px - lastCameraPosition.x) < epsilon &&
            Math.abs(py - lastCameraPosition.y) < epsilon &&
            Math.abs(pz - lastCameraPosition.z) < epsilon) {
            return;
        }

        lastCameraPosition.x = px;
        lastCameraPosition.y = py;
        lastCameraPosition.z = pz;

        // create distance buffer
        const numVertices = centers.length / 3;
        if (distances?.length !== numVertices) {
            distances = new Uint32Array(numVertices);
        }

        if (target?.length !== data.length) {
            target = data.slice();
        }

        const len = (x, y, z) => Math.sqrt(x * x + y * y + z * z);

        const sceneCenterDist = len(
            (boundMin.x + boundMax.x) * 0.5 - px,
            (boundMin.y + boundMax.y) * 0.5 - py,
            (boundMin.z + boundMax.z) * 0.5 - pz
        );

        const sceneRadius = 0.5 * len(
            boundMax.x - boundMin.x,
            boundMax.y - boundMin.y,
            boundMax.z - boundMin.z
        );

        const minDist = Math.max(0, sceneCenterDist - sceneRadius);
        const maxDist = sceneCenterDist + sceneRadius;

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
            const d = Math.sqrt(x * x + y * y + z * z);
            const sortKey = Math.floor((maxDist - d) * divider);

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
        const dist = (i) => distances[target[i]] / divider + minDist;
        const findZero = () => {
            const result = binarySearch(0, numVertices - 1, (i) => -dist(i));
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

        update();
    };
}

class GSplatSorter extends EventHandler {
    worker;

    vertexBuffer;

    constructor() {
        super();

        this.worker = new Worker(URL.createObjectURL(new Blob([`(${SortWorker.toString()})()`], {
            type: 'application/javascript'
        })));

        this.worker.onmessage = (message) => {
            const newData = message.data.data;
            const oldData = this.vertexBuffer.storage;

            // send vertex storage to worker to start the next frame
            this.worker.postMessage({
                data: oldData
            }, [oldData]);

            this.vertexBuffer.setData(newData);

            // set new data directly on texture
            this.fire('updated', message.data.count);
        };
    }

    destroy() {
        this.worker.terminate();
        this.worker = null;
    }

    init(vertexBuffer, centers) {
        this.vertexBuffer = vertexBuffer;

        const buf = vertexBuffer.storage.slice();

        // send the initial buffer to worker
        this.worker.postMessage({
            data: buf,
            centers: centers.buffer
        }, [buf, centers.buffer]);
    }

    setCamera(pos, dir) {
        this.worker.postMessage({
            cameraPosition: { x: pos.x, y: pos.y, z: pos.z },
        });
    }
}

export { GSplatSorter };
