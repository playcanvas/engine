// sort blind set of data
function SortWorker() {

    // number of bits used to store the distance in integer array. Smaller number gives it a smaller
    // precision but faster sorting. Could be dynamic for less precise sorting.
    // 16bit seems plenty of large scenes (train), 10bits is enough for sled.
    const compareBits = 16;

    // number of buckets for count sorting to represent each unique distance using compareBits bits
    const bucketCount = (2 ** compareBits) + 1;

    let centers;
    let cameraPosition;
    let cameraDirection;
    let intIndices;

    const boundMin = { x: 0, y: 0, z: 0 };
    const boundMax = { x: 0, y: 0, z: 0 };

    let distances;
    let indices;
    let target;
    let countBuffer;

    const update = () => {

        const px = cameraPosition.x;
        const py = cameraPosition.y;
        const pz = cameraPosition.z;
        const dx = cameraDirection.x;
        const dy = cameraDirection.y;
        const dz = cameraDirection.z;

        // create distance buffer
        const numVertices = centers.length / 3;
        if (distances?.length !== numVertices) {
            distances = new Uint32Array(numVertices);
            indices = new Uint32Array(numVertices);
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
            indices[i] = i;

            // count occurrences of each distance
            countBuffer[sortKey]++;
        }

        // Change countBuffer[i] so that it contains actual position of this digit in outputArray
        for (let i = 1; i < bucketCount; i++)
            countBuffer[i] += countBuffer[i - 1];

        // Build the output array
        const outputArray = intIndices ? new Uint32Array(target.buffer) : target;
        const offset = intIndices ? 0 : 0.2;
        for (let i = numVertices - 1; i >= 0; i--) {
            const distance = distances[i];
            const index = indices[i];
            outputArray[countBuffer[distance] - 1] = index + offset;
            countBuffer[distance]--;
        }
    };

    self.onmessage = (message) => {

        // TODO: we should pass bounds from the main thread
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
        if (message.data.intIndices) {
            intIndices = message.data.intIndices;
        }
        if (message.data.cameraPosition) cameraPosition = message.data.cameraPosition;
        if (message.data.cameraDirection) cameraDirection = message.data.cameraDirection;

        if (message.data.data) {

            target = new Float32Array(message.data.data);

            if (centers && target && cameraPosition && cameraDirection) {
                update();
            }

            // send back the results
            self.postMessage({
                data: target.buffer
            }, [target.buffer]);

            target = null;
        }
    };
}

class SplatSorter {
    worker;

    onSortedDataCallback;

    busy = false;

    constructor(onSortedDataCallback) {
        this.onSortedDataCallback = onSortedDataCallback;

        this.worker = new Worker(URL.createObjectURL(new Blob([`(${SortWorker.toString()})()`], {
            type: 'application/javascript'
        })));

        // receive results from the worker
        this.worker.onmessage = (message) => {

            const newData = message.data.data;
            this.onSortedDataCallback(newData);

            this.busy = false;
        };
    }

    destroy() {
        this.worker.terminate();
        this.onSortedDataCallback = null;
    }

    init(centers, intIndices) {

        // send centers to the worker
        this.worker.postMessage({
            centers: centers.buffer,
            intIndices: intIndices
        }, [centers.buffer]);
    }

    sort(data, pos, dir) {

        if (!this.busy) {
            this.busy = true;
            this.worker.postMessage({
                data: data,
                cameraPosition: { x: pos.x, y: pos.y, z: pos.z },
                cameraDirection: { x: dir.x, y: dir.y, z: dir.z }
            }, [data]);
        }
    }
}

export { SplatSorter };
