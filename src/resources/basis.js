import { PIXELFORMAT_R5_G6_B5, PIXELFORMAT_R4_G4_B4_A4 } from '../graphics/constants.js';
import { getApplication } from '../framework/globals.js';
import { BasisWorker } from './basis-worker.js';
import { http } from '../net/http.js';

// get the list of the device's supported compression formats
const getCompressionFormats = (device) => {
    return {
        astc: !!device.extCompressedTextureASTC,
        atc: !!device.extCompressedTextureATC,
        dxt: !!device.extCompressedTextureS3TC,
        etc1: !!device.extCompressedTextureETC1,
        etc2: !!device.extCompressedTextureETC,
        pvr: !!device.extCompressedTexturePVRTC
    };
};

// download basis code and compile the wasm module for use in workers
const prepareWorkerModules = (config, callback) => {
    const getWorkerBlob = () => {
        const code = '(' + BasisWorker.toString() + ')()\n\n';
        return new File([code], 'basis_worker.js', { type: 'application/javascript' });
    };

    const wasmSupported = () => {
        try {
            if (typeof WebAssembly === "object" && typeof WebAssembly.instantiate === "function") {
                const module = new WebAssembly.Module(Uint8Array.of(0x0, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00));
                if (module instanceof WebAssembly.Module)
                    return new WebAssembly.Instance(module) instanceof WebAssembly.Instance;
            }
        } catch (e) { }
        return false;
    };

    const sendResponse = (basisCode, module) => {
        const device = getApplication().graphicsDevice;
        callback(null, {
            workerUrl: URL.createObjectURL(getWorkerBlob()),
            basisUrl: URL.createObjectURL(basisCode),
            module: module,
            deviceDetails: {
                webgl2: device.webgl2,
                formats: getCompressionFormats(device),
                rgbPriority: config.rgbPriority || ['etc1', 'etc2', 'astc', 'dxt', 'pvr', 'atc'],
                rgbaPriority: config.rgbaPriority || ['astc', 'dxt', 'etc2', 'pvr', 'atc']
            }
        });
    };

    if (config.glueUrl && config.wasmUrl && wasmSupported()) {
        let basisCode = null;
        let module = null;

        // download glue script
        http.get(config.glueUrl, { responseType: 'blob' }, (err, response) => {
            if (err) {
                callback(err);
            } else {
                if (module) {
                    sendResponse(response, module);
                } else {
                    basisCode = response;
                }
            }
        });

        const fetchPromise = fetch(config.wasmUrl);

        const compileManual = () => {
            fetchPromise
                .then((result) => result.arrayBuffer())
                .then((buffer) => WebAssembly.compile(buffer))
                .then((module_) => {
                    if (basisCode) {
                        sendResponse(basisCode, module_);
                    } else {
                        module = module_;
                    }
                })
                .catch((err) => {
                    callback(err, null);
                });
        };

        // download and compile wasm module
        if (WebAssembly.compileStreaming) {
            WebAssembly.compileStreaming(fetchPromise)
                .then((module_) => {
                    if (basisCode) {
                        sendResponse(basisCode, module_);
                    } else {
                        module = module_;
                    }
                })
                .catch((err) => {
                    console.warn('compileStreaming() failed for ' + config.wasmUrl + '(' + err + '), falling back to arraybuffer download.');
                    compileManual();
                });
        } else {
            compileManual();
        }
    } else {
        http.get(config.fallbackUrl, { responseType: 'blob' }, (err, response) => {
            if (err) {
                callback(err, null);
            } else {
                sendResponse(response, null);
            }
        });
    }
};

// queue of transcode jobs and clients ready to run them
class BasisQueue {
    constructor() {
        this.callbacks = {};
        this.queue = [];
        this.clients = [];
    }

    enqueueJob(url, data, callback, options) {
        if (this.callbacks.hasOwnProperty(url)) {
            // duplicate URL request
            this.callbacks[url].push(callback);
        } else {
            // new URL request
            this.callbacks[url] = [callback];

            const job = {
                url: url,
                data: data,
                options: options
            };

            if (this.clients.length > 0) {
                this.clients.shift().run(job);
            } else {
                this.queue.push(job);
            }
        }
    }

    enqueueClient(client) {
        if (this.queue.length > 0) {
            client.run(this.queue.shift());
        } else {
            this.clients.push(client);
        }
    }

    handleResponse(url, err, data) {
        const callback = this.callbacks[url];

        if (err) {
            for (let i = 0; i < callback.length; ++i) {
                (callback[i])(err);
            }
        } else {
            // (re)create typed array from the returned array buffers
            if (data.format === PIXELFORMAT_R5_G6_B5 || data.format === PIXELFORMAT_R4_G4_B4_A4) {
                // handle 16 bit formats
                data.levels = data.levels.map(function (v) {
                    return new Uint16Array(v);
                });
            } else {
                // all other
                data.levels = data.levels.map(function (v) {
                    return new Uint8Array(v);
                });
            }

            for (let i = 0; i < callback.length; ++i) {
                (callback[i])(null, data);
            }
        }
        delete this.callbacks[url];
    }
}

class BasisClient {
    constructor(queue, config, eager) {
        this.queue = queue;
        this.worker = new Worker(config.workerUrl);
        this.worker.addEventListener('message', (message) => {
            const data = message.data;
            this.queue.handleResponse(data.url, data.err, data.data);
            if (!this.eager) {
                this.queue.enqueueClient(this);
            }
        });
        this.worker.postMessage({ type: 'init', config: config });

        // an eager client will enqueue itself while a job is running. a
        // non-eager client will only enqueue itself once the current job
        // has finished running.
        this.eager = eager;
    }

    run(job) {
        this.worker.postMessage({
            type: 'transcode',
            url: job.url,
            format: job.format,
            data: job.data,
            options: job.options
        }, [
            job.data
        ]);
        if (this.eager) {
            this.queue.enqueueClient(this);
        }
    }
}

// global state
const defaultNumWorkers = 1;
const queue = new BasisQueue();
let initializing = false;

// initialize basis
// config supports the following parameters:
// glueUrl: url of glue code
// wasmUrl: url of wasm module
// fallbackUrl: fallback URL when wasm isn't supported
// rgbPriority: array of texture compression formats in priority order for textures sans alpha
// rgbaPriority: array of texture compression formats in priority order for textures with alpha
// numWorkers: number of transcode workers to create (default is 1)
// eagerWorkers: whether workers are eager or not (default is true for workers === 1)
function basisInitialize(config) {
    if (initializing) {
        // already initializing
        return;
    }

    if (!config) {
        // get config from global PC config structure
        const modules = (window.config ? window.config.wasmModules : window.PRELOAD_MODULES) || [];
        const wasmModule = modules.find(function (m) {
            return m.moduleName === 'BASIS';
        });
        if (wasmModule) {
            const urlBase = window.ASSET_PREFIX ? window.ASSET_PREFIX : "";
            config = {
                glueUrl: urlBase + wasmModule.glueUrl,
                wasmUrl: urlBase + wasmModule.wasmUrl,
                fallbackUrl: urlBase + wasmModule.fallbackUrl
            };
        }
    }

    if (config) {
        initializing = true;
        prepareWorkerModules(config, (err, clientConfig) => {
            const numWorkers = config.numWorkers || defaultNumWorkers;
            for (let i = 0; i < numWorkers; ++i) {
                queue.enqueueClient(new BasisClient(queue, clientConfig, (numWorkers === 1) || config.eagerWorkers));
            }
        });
    }
}

// queue a basis file for transcoding
//
// options supports the following members:
//   isGGGR - indicates this is a GGGR swizzled texture. under some
//            circumstances the texture will be unswizzled during compression
function basisTranscode(url, data, callback, options) {
    basisInitialize();
    queue.enqueueJob(url, data, callback, options);
    return initializing;
}

export {
    basisInitialize,
    basisTranscode
};
