import { PIXELFORMAT_R5_G6_B5, PIXELFORMAT_R4_G4_B4_A4 } from '../graphics/constants.js';
import { getApplication } from '../framework/globals.js';
import { BasisWorker } from './basis-worker.js';
import { http } from '../net/http.js';

// download basis code and compile the wasm module for use in workers
const prepareWorkerModules = (urls, callback) => {
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
            module: module
        });
    };

    if (urls.glue && urls.wasm && wasmSupported()) {
        let basisCode = null;
        let module = null;

        // download glue script
        http.get(urls.glue, { responseType: 'blob' }, (err, response) => {
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

        const fetchPromise = fetch(urls.wasm);

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
                    console.warn('compileStreaming() failed for ' + urls.wasm + '(' + err + '), falling back to arraybuffer download.');
                    compileManual();
                });
        } else {
            compileManual();
        }
    } else {
        http.get(urls.fallback, { responseType: 'blob' }, (err, response) => {
            if (err) {
                callback(err, null);
            } else {
                sendResponse(response, null);
            }
        });
    }
};

class BasisClient {
    constructor(config) {
        this.worker = new Worker(config.workerUrl);
        this.worker.addEventListener('message', this.handleWorkerResponse.bind(this));
        this.worker.postMessage({ type: 'init', config: config });
        this.callbacks = { };
        this.queueLength = 0;
    }

    // post a transcode job to the web worker
    transcode(url, data, format, callback, options) {
        if (!this.callbacks.hasOwnProperty(url)) {
            // store url and kick off worker job
            this.callbacks[url] = [callback];
            this.queueLength++;
            this.worker.postMessage({
                type: 'transcode',
                url: url,
                format: format,
                data: data,
                options: options
            }, [
                data
            ]);
        } else {
            // the basis worker is already busy processing this url, store callback
            // (this shouldn't really happen since the asset system only requests
            // a resource once)
            this.callbacks[url].push(callback);
        }
    }

    handleWorkerResponse(message) {
        const url = message.data.url;
        const err = message.data.err;
        const data = message.data.data;
        const callback = this.callbacks[url];

        if (!callback) {
            console.error('internal logical error encountered in basis transcoder');
            return;
        }

        let i;
        if (err) {
            for (i = 0; i < callback.length; ++i) {
                (callback[i])(err);
            }
            return;
        }

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

        for (i = 0; i < callback.length; ++i) {
            (callback[i])(null, data);
        }

        delete this.callbacks[url];
        this.queueLength--;
    }
}

// select the most desirable gpu texture compression format given the device's capabilities
function chooseTargetFormat(device) {
    if (device.extCompressedTextureASTC) {
        return 'astc';
    } else if (device.extCompressedTextureS3TC) {
        return 'dxt';
    } else if (device.extCompressedTextureETC) {
        return 'etc2';
    } else if (device.extCompressedTextureETC1) {
        return 'etc1';
    } else if (device.extCompressedTexturePVRTC) {
        return 'pvr';
    } else if (device.extCompressedTextureATC) {
        return 'atc';
    }
    return 'none';
}

// global state
const defaultNumClients = 1;
const clients = [];
let queue = null;
let format = null;

function basisTargetFormat() {
    if (!format) {
        format = chooseTargetFormat(getApplication().graphicsDevice);
    }
    return format;
}

// initialize basis
function basisInitialize(config) {
    if (queue !== null) {
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
                glue: urlBase + wasmModule.glueUrl,
                wasm: urlBase + wasmModule.wasmUrl,
                fallback: urlBase + wasmModule.fallbackUrl
            };
        }
    }

    if (config) {
        queue = [];
        prepareWorkerModules(config, (err, clientConfig) => {
            const numClients = config.numClients || defaultNumClients;
            for (let i = 0; i < numClients; ++i) {
                clients.push(new BasisClient(clientConfig));
            }

            const todo = queue;
            queue = null;
            todo.forEach((t) => {
                basisTranscode(t.url, t.data, t.callback, t.options);
            });
        });
    }
}

// queue a basis file for transcoding
//
// options supports the following members:
//   unswizzleGGGR - convert the two-component GGGR normal data to RGB
//                   and pack into 565 format. this is used to overcome
//                   quality issues on apple devices.
function basisTranscode(url, data, callback, options) {
    if (clients.length > 0) {
        // find the client with shortest queue
        let client = clients[0];
        if (client.queueLength > 0) {
            for (let i = 1; i < clients.length; ++i) {
                const c = clients[i];
                if (c.queueLength < client.queueLength) {
                    client = c;
                }
            }
        }
        client.transcode(url, data, basisTargetFormat(), callback, options);
    } else {
        basisInitialize();
        queue.push({
            url: url,
            data: data,
            callback: callback,
            options: options
        });
    }
    return true;
}

export {
    basisTargetFormat,
    basisInitialize,
    basisTranscode
};
