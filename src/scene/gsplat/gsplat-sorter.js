import { EventHandler } from '../../core/event-handler.js';
import { TEXTURELOCK_READ } from '../../platform/graphics/constants.js';
import { platform } from '../../core/platform.js';
import { SortWorker } from './gsplat-sort-worker.js';

class GSplatSorter extends EventHandler {
    worker;

    orderTexture;

    centers;

    scene;

    constructor(scene) {
        super();
        this.scene = scene ?? null;

        const messageHandler = (message) => {
            const msgData = message.data ?? message;

            // Fire sortTime event on scene
            if (this.scene && msgData.sortTime !== undefined) {
                this.scene.fire('gsplat:sorted', msgData.sortTime);
            }

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
            this.fire('updated', msgData.count);
        };

        const workerSource = `(${SortWorker.toString()})()`;

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
