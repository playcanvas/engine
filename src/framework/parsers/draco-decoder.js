import { WasmModule } from "../../core/wasm-module.js";
import { DracoWorker } from "./draco-worker.js";
import { Debug } from "../../core/debug.js";
import { http } from '../../platform/net/http.js';

const downloadMaxRetries = 3;

// JobQueue keeps track of a set of web workers and enqueues jobs
// on them. To keep workload as balanced as possible (but also keep
// workers busy) workers have a maximum of 2 jobs assigned at any
// one time.
class JobQueue {
    constructor() {
        // list of workers with: [[0 jobs], [1 job], [2 jobs]]
        this.workers = [[], [], []];
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
    }

    // initialize the queue with worker instances
    init(workers) {
        workers.forEach((worker) => {
            worker.addEventListener('message', (message) => {
                const data = message.data;
                const callback = this.jobCallbacks.get(data.jobId);
                if (callback) {
                    callback(data.error, {
                        indices: data.indices,
                        vertices: data.vertices,
                        attributes: data.attributes
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
                            Debug.error('logical error');
                        }
                    }
                }
            });
        });

        // assign workers to the first queue
        this.workers[0] = workers;

        // run queued up jobs
        while (this.jobQueue.length && (this.workers[0].length || this.workers[1].length)) {
            const job = this.jobQueue.shift();
            if (this.workers[0].length > 0) {
                const worker = this.workers[0].shift();
                this.workers[1].push(worker);
                this.run(worker, job);
            } else {
                const worker = this.workers[1].shift();
                this.workers[2].push(worker);
                this.run(worker, job);
            }
        }
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
}

const downloadScript = (url) => {
    return new Promise((resolve, reject) => {
        const options = {
            cache: true,
            responseType: 'text',
            retry: downloadMaxRetries > 0,
            maxRetries: downloadMaxRetries
        };

        http.get(url, options, (err, response) => {
            if (err) {
                reject(err);
            } else {
                resolve(response);
            }
        });
    });
};

const compileModule = (url) => {
    const compileManual = () => {
        return fetch(url)
            .then(result => result.arrayBuffer())
            .then(buffer => WebAssembly.compile(buffer));
    };

    const compileStreaming = () => {
        return WebAssembly.compileStreaming(fetch(url))
            .catch((err) => {
                Debug.warn(`compileStreaming() failed for ${url} (${err}), falling back to arraybuffer download.`);
                return compileManual();
            });
    };

    // download and compile wasm module
    return WebAssembly.compileStreaming ? compileStreaming() : compileManual();
};

const defaultNumWorkers = 1;

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
                    wasmUrl: moduleConfig.wasmUrl,
                    numWorkers: moduleConfig.numWorkers
                };
            } else {
                config = {
                    jsUrl: 'draco.wasm.js',
                    wasmUrl: 'draco.wasm.wasm',
                    numWorkers: defaultNumWorkers
                };
            }
        }
    }

    if (!config.jsUrl || !config.wasmUrl) {
        return false;
    }

    // create the job queue
    jobQueue = new JobQueue();

    // worker urls must be absolute
    Promise.all([downloadScript(config.jsUrl), compileModule(config.wasmUrl)])
        .then(([dracoSource, dracoModule]) => {
            // build worker source
            const code = [
                '/* draco */',
                dracoSource,
                '/* worker */',
                `(\n${DracoWorker.toString()}\n)()\n\n`
            ].join('\n');
            const blob = new Blob([code], { type: 'application/javascript' });
            const workerUrl = URL.createObjectURL(blob);
            const numWorkers = Math.max(1, Math.min(16, config.numWorkers || defaultNumWorkers));

            // create worker instances
            const workers = [];
            for (let i = 0; i < numWorkers; ++i) {
                const worker = new Worker(workerUrl);
                worker.postMessage({
                    type: 'init',
                    module: dracoModule
                });
                workers.push(worker);
            }
            jobQueue.init(workers);
        });

    return true;
};

/**
 * Initialize the Draco mesh decoder.
 *
 * @param {object} [config] - The Draco decoder configuration.
 * @param {string} [config.jsUrl] - URL of glue script.
 * @param {string} [config.wasmUrl] - URL of the wasm module.
 * @param {number} [config.numWorkers] - Number of workers to use for decoding (default is 1).
 * @param {boolean} [config.lazyInit] - Wait for first decode request before initializing workers
 * (default is false). Otherwise initialize workers immediately.
 */
const dracoInitialize = (config) => {
    if (config?.lazyInit) {
        lazyConfig = config;
    } else {
        initializeWorkers(config);
    }
};

/**
 * Enqueue a buffer for decoding.
 *
 * @param {ArrayBuffer} buffer - The draco data to decode.
 * @param {Function} callback - Callback function to receive decoded result.
 * @returns {boolean} True if the draco worker was initialized and false otherwise.
 * @ignore
 */
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
