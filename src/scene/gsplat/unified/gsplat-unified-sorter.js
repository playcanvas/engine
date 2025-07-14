import { EventHandler } from '../../../core/event-handler.js';
import { TEXTURELOCK_READ } from '../../../platform/graphics/constants.js';
import { platform } from '../../../core/platform.js';
import { UnifiedSortWorker } from './gsplat-unified-sort-worker.js';

class GSplatUnifiedSorter extends EventHandler {
    worker;

    orderTexture;

    constructor() {
        super();

        const messageHandler = (message) => {
            const msgData = message.data ?? message;

            const newOrder = msgData.order;
            const oldOrder = this.orderTexture._levels[0].buffer;

            // send vertex storage to worker to start the next frame
            this.worker.postMessage({
                order: oldOrder
            }, [oldOrder]);

            // write the new order data to gpu texture memory
            this.orderTexture._levels[0] = new Uint32Array(newOrder);
            this.orderTexture.upload();

            // set new data directly on texture
            const returnCenters = msgData.returnCenters ? new Float32Array(msgData.returnCenters) : null;
            this.fire('updated', msgData.count, msgData.version, returnCenters);
        };

        const workerSource = `(${UnifiedSortWorker.toString()})()`;

        if (platform.environment === 'node') {
            this.worker = new Worker(workerSource, {
                eval: true
            });
            this.worker.on('message', messageHandler);
        } else {
            this.worker = new Worker(URL.createObjectURL(new Blob([workerSource], {
                type: 'application/javascript'
            })));
            this.worker.addEventListener('message', messageHandler);
        }
    }

    destroy() {
        this.worker.terminate();
        this.worker = null;
    }

    init(orderTexture) {
        this.orderTexture = orderTexture;

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
            order: orderBuffer.buffer
        };

        const transfer = [orderBuffer.buffer];

        // send the initial buffer to worker
        this.worker.postMessage(obj, transfer);
    }

    setCenters(centers, version, sortSplatCount) {

        // console.log('sorting', sortSplatCount.toLocaleString(), ' of ', (centers.length / 3).toLocaleString());

        this.worker.postMessage({
            version: version,
            sortSplatCount: sortSplatCount,
            centers: centers.buffer,
            mapping: null
        }, [centers.buffer]);
    }

    setCamera(pos, dir) {
        this.worker.postMessage({
            cameraPosition: { x: pos.x, y: pos.y, z: pos.z },
            cameraDirection: { x: dir.x, y: dir.y, z: dir.z }
        });
    }

    setSortParams(params) {
        this.worker.postMessage({
            sortParams: params
        });
    }
}

export { GSplatUnifiedSorter };
