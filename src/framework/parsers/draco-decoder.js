import { WasmModule } from "../../core/wasm-module";
import { DracoWorker } from "./draco-worker";

class JobQueue {
    constructor(workers) {
        this.workers = [workers, [], []];
        this.jobId = 0;
        this.jobQueue = [];
        this.jobCallbacks = new Map();
        this.run = (worker, job) => {
            worker.postMessage({
                type: 'decodeMesh',
                jobId: job.jobId,
                buffer: job.buffer
            }, [job.buffer]);
        };

        workers.forEach((worker) => {
            worker.addEventListener('message', (message) => {
                const data = message.data;
                const callback = this.jobCallbacks.get(data.jobId);
                if (callback) {
                    callback(data.error, {
                        indices: data.indices,
                        vertices: data.vertices
                    });
                }
                this.jobCallbacks.delete(data.jobId);

                if (this.jobQueue.length > 0) {
                    const job = this.jobQueue.shift();
                    this.run(worker, job);
                } else {
                    const index2 = this.workers[2].indexOf(worker);
                    if (index2 !== -1) {
                        this.workers[2].splice(index2, 1);
                        this.workers[1].push(worker);
                    } else {
                        const index1 = this.workers[1].indexOf(worker);
                        if (index1 !== -1) {
                            this.workers[1].splice(index1, 1);
                            this.workers[0].push(worker);
                        } else {
                            // logical error
                            console.log('logical error');
                        }
                    }
                }
            });
        });
    }

    enqueueJob(buffer, callback) {
        const job = {
            jobId: this.jobId++,
            buffer: buffer
        };
        this.jobCallbacks.set(job.jobId, callback);

        if (this.workers[0].length > 0) {
            const worker = this.workers[0].shift();
            this.workers[1].push(worker);
            this.run(worker, job);
        } else if (this.workers[1].length > 0) {
            const worker = this.workers[1].shift();
            this.workers[2].push(worker);
            this.run(worker, job);
        } else {
            this.jobQueue.push(job);
        }
    }
};

const defaultNumWorkers = 4;

let jobQueue;
let lazyConfig;

const initializeWorkers = (config) => {
    if (jobQueue) {
        return true;
    }

    if (!config) {
        if (lazyConfig) {
            config = lazyConfig;
        } else {
            const moduleConfig = WasmModule.getConfig('DracoDecoderModule');
            if (moduleConfig) {
                config = {
                    jsUrl: moduleConfig.glueUrl,
                    wasmUrl: moduleConfig.wasmUrl
                };
            } else {
                config = {
                    jsUrl: 'draco.wasm.js',
                    wasmUrl: 'draco.wasm.wasm'
                };
            }
        }
    }

    if (!config.jsUrl || !config.wasmUrl) {
        return false;
    }

    // worker urls must be absolute
    const jsUrl = new URL(window.location.href);
    jsUrl.pathname += config.jsUrl;

    const wasmUrl = new URL(window.location.href);
    wasmUrl.pathname += config.wasmUrl;

    // create workers
    const numWorkers = Math.max(1, Math.min(16, config.numWorkers || defaultNumWorkers));
    const code = `(${DracoWorker.toString()})('${jsUrl.toString()}', '${wasmUrl.toString()}')\n\n`;
    const blob = new Blob([code], { type: 'application/javascript' });
    const workerUrl = URL.createObjectURL(blob);
    const workers = [];
    for (let i = 0; i < numWorkers; ++i) {
        workers.push(new Worker(workerUrl));
    }
    jobQueue = new JobQueue(workers);
    return true;
};

const dracoInitialize = (config) => {
    if (config.lazyInit) {
        lazyConfig = config;
    } else {
        initializeWorkers(config);
    }
};

const dracoDecode = (buffer, callback) => {
    if (!initializeWorkers()) {
        return false;
    }
    jobQueue.enqueueJob(buffer, callback);
    return true;
};

export {
    dracoInitialize,
    dracoDecode
};