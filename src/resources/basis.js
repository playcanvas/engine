import { PIXELFORMAT_R5_G6_B5, PIXELFORMAT_R4_G4_B4_A4 } from '../graphics/constants.js';
import { getApplication } from '../framework/globals.js';
import { BasisWorker } from './basis-worker.js';

class BasisClient {
    constructor(urls) {
        const code = '(' + BasisWorker.toString() + ')()\n\n';
        const blob = new File([code], 'basis_worker.js', { type: 'application/javascript' });
        const url = URL.createObjectURL(blob);

        this.worker = new Worker(url);
        this.worker.addEventListener('message', this.handleWorkerResponse.bind(this));
        this.worker.postMessage({ type: 'init', urls: urls });

        this.callbacks = { };
    }

    // post a transcode job to the web worker
    transcode(url, data, format, callback, options) {
        if (!this.callbacks.hasOwnProperty(url)) {
            // store url and kick off worker job
            this.callbacks[url] = [callback];
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
let downloadConfig = null;
let clients = null;
let format = null;
let client = 0;

function basisTargetFormat() {
    if (!format) {
        format = chooseTargetFormat(getApplication().graphicsDevice);
    }
    return format;
}

// set the wasm url config to be used if basisDownloadFromConfig is invoked
function basisSetDownloadConfig(glueUrl, wasmUrl, fallbackUrl) {
    downloadConfig = {
        glue: glueUrl,
        wasm: wasmUrl,
        fallback: fallbackUrl
    };
}

function basisGetDownloadConfig() {
    if (downloadConfig) {
        return downloadConfig;
    }

    // get config from global PC config structure
    const modules = (window.config ? window.config.wasmModules : window.PRELOAD_MODULES) || [];
    const wasmModule = modules.find(function (m) {
        return m.moduleName === 'BASIS';
    });
    if (wasmModule) {
        const urlBase = window.ASSET_PREFIX ? window.ASSET_PREFIX : "";
        return {
            glue: urlBase + wasmModule.glueUrl,
            wasm: urlBase + wasmModule.wasmUrl,
            fallback: urlBase + wasmModule.fallbackUrl
        };
    }

    return null;
}

function basisInitialize() {
    if (!clients) {
        clients = [
            new BasisClient(basisGetDownloadConfig()),
            new BasisClient(basisGetDownloadConfig())
        ];
    }
}

// transcode a basis file
//
// options supports the following members:
//   unswizzleGGGR - convert the two-component GGGR normal data to RGB
//                   and pack into 565 format. this is used to overcome
//                   quality issues on apple devices.
// returns true if a transcode module is found
function basisTranscode(url, data, callback, options) {
    if (!clients) {
        basisInitialize();
    }

    clients[client++].transcode(url, data, basisTargetFormat(), callback, options);
    client %= clients.length;

    return true;
}

export {
    basisTargetFormat,
    basisSetDownloadConfig,
    basisInitialize,
    basisTranscode
};
