import { PIXELFORMAT_R5_G6_B5, PIXELFORMAT_R4_G4_B4_A4 } from '../graphics/constants.js';
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
        callback(null, {
            workerUrl: URL.createObjectURL(getWorkerBlob()),
            basisUrl: URL.createObjectURL(basisCode),
            module: module,
            rgbPriority: config.rgbPriority,
            rgbaPriority: config.rgbaPriority
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
                    // #if _DEBUG
                    console.warn(`compileStreaming() failed for ${config.wasmUrl} (${err}), falling back to arraybuffer download.`);
                    // #endif
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

// client interface to a basis transcoder instance running on a web worker
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

// defaults
const defaultNumWorkers = 1;
const defaultRgbPriority = ['etc1', 'etc2', 'astc', 'dxt', 'pvr', 'atc'];
const defaultRgbaPriority = ['astc', 'dxt', 'etc2', 'pvr', 'atc'];

// global state
const queue = new BasisQueue();
let lazyConfig = null;
let initializing = false;

/**
 * @name basisInitialize
 * @function
 * @description Initialize the Basis transcode worker.
 * @param {object} [config] - The Basis configuration.
 * @param {string} [config.glueUrl] - URL of glue script.
 * @param {string} [config.wasmUrl] - URL of the wasm module.
 * @param {string} [config.fallbackUrl] - URL of the fallback script to use when wasm modules aren't supported.
 * @param {boolean} [config.lazyInit] - Wait for first transcode request before initializing Basis
 * (default is false). Otherwise initialize Basis immediately.
 * @param {number} [config.numWorkers] - Number of workers to use for transcoding (default is 1). While it is
 * possible to improve transcode performance using multiple workers, this will likely depend on the runtime
 * platform. For example, desktop will likely benefit from more workers compared to mobile. Also
 * keep in mind that it takes time to initialize workers and increasing this value could impact application
 * startup time. Make sure to test your application performance on all target platforms when changing this parameter.
 * @param {boolean} [config.eagerWorkers] - Use eager workers (default is true). When enabled, jobs are assigned
 * to workers immediately, independent of their work load. This can result in unbalanced workloads, however there
 * is no delay between jobs. If disabled, new jobs are assigned to workers only when their previous job has
 * completed. This will result in balanced workloads across workers, however workers can be idle for a short time between jobs.
 * @param {string[]} [config.rgbPriority] - Array of texture compression formats in priority order for textures without alpha.
 * The supported compressed formats are: 'astc', 'atc', 'dxt', 'etc1', 'etc2', 'pvr'.
 * @param {string[]} [config.rgbaPriority] - Array of texture compression formats in priority order for textures with alpha.
 * The supported compressed formats are: 'astc', 'atc', 'dxt', 'etc1', 'etc2', 'pvr'.
 */
function basisInitialize(config) {
    if (initializing) {
        // already initializing
        return;
    }

    if (!config) {
        config = lazyConfig || {};
    } else if (config.lazyInit) {
        lazyConfig = config;
        return;
    }

    // if any URLs are not specified in the config, take them from the global PC config structure
    if (!config.glueUrl || !config.wasmUrl || !config.fallbackUrl) {
        const modules = (window.config ? window.config.wasmModules : window.PRELOAD_MODULES) || [];
        const wasmModule = modules.find(function (m) {
            return m.moduleName === 'BASIS';
        });
        if (wasmModule) {
            const urlBase = window.ASSET_PREFIX || "";
            if (!config.glueUrl) {
                config.glueUrl = urlBase + wasmModule.glueUrl;
            }
            if (!config.wasmUrl) {
                config.wasmUrl = urlBase + wasmModule.wasmUrl;
            }
            if (!config.fallbackUrl) {
                config.fallbackUrl = urlBase + wasmModule.fallbackUrl;
            }
        }
    }

    if (config.glueUrl || config.wasmUrl || config.fallbackUrl) {
        initializing = true;

        const numWorkers = Math.max(1, Math.min(16, config.numWorkers || defaultNumWorkers));
        const eagerWorkers = (config.numWorkers === 1) || (config.hasOwnProperty('eagerWorkers') ? config.eagerWorkers : true);

        config.rgbPriority = config.rgbPriority || defaultRgbPriority;
        config.rgbaPriority = config.rgbaPriority || defaultRgbaPriority;

        prepareWorkerModules(config, (err, clientConfig) => {
            if (err) {
                console.error(`failed to initialize basis worker: ${err}`);
            } else {
                for (let i = 0; i < numWorkers; ++i) {
                    queue.enqueueClient(new BasisClient(queue, clientConfig, eagerWorkers));
                }
            }
        });
    }
}

let deviceDetails = null;

/**
 * @private
 * @name basisTranscode
 * @function
 * @description Enqueue a blob of basis data for transcoding.
 * @param {GraphicsDevice} device - The graphics device.
 * @param {string} url - URL of the basis file.
 * @param {object} data - The file data to transcode.
 * @param {Function} callback - Callback function to receive transcode result.
 * @param {object} [options] - Options structure
 * @param {boolean} [options.isGGGR] - Indicates this is a GGGR swizzled texture. Under some
 * circumstances the texture will be unswizzled during transcoding.
 * @returns {boolean} True if the basis worker was initialized and false otherwise.
 */
function basisTranscode(device, url, data, callback, options) {
    basisInitialize();

    if (!deviceDetails) {
        deviceDetails = {
            webgl2: device.webgl2,
            formats: getCompressionFormats(device)
        };
    }

    queue.enqueueJob(url, data, callback, {
        deviceDetails: deviceDetails,
        isGGGR: !!options?.isGGGR
    });

    return initializing;
}

export {
    basisInitialize,
    basisTranscode
};
