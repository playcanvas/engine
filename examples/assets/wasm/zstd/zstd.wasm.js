// Glue script for the ZSTD decompression WebAssembly module (decompression only).
//
// The wasm binary (zstd.wasm.wasm) is the single-file zstd decoder (zstddeclib) from the
// Zstandard project (https://github.com/facebook/zstd, BSD-3-Clause), compiled to WebAssembly
// by the zstddec project (https://github.com/donmccurdy/zstddec, MIT).
//
// This script conforms to the WasmModule contract: it exposes a global factory function
// which is passed a config object with locateFile() and returns a promise of the module
// instance. Register it like this:
//
//     import { WasmModule } from 'playcanvas';
//
//     WasmModule.setConfig('ZstdDecoderModule', {
//         glueUrl: 'zstd.wasm.js',
//         wasmUrl: 'zstd.wasm.wasm'
//     });
//
// The resolved instance exposes:
//
//     decompress(src: Uint8Array, decompressedSize: number): Uint8Array
(function () {
    function ZstdDecoderModule(config) {
        config = config || {};

        var instance = null;
        var heap = null;

        var refreshHeap = function () {
            heap = new Uint8Array(instance.exports.memory.buffer);
        };

        // the only import the wasm module needs - notification of memory growth
        var imports = {
            env: {
                emscripten_notify_memory_growth: function () {
                    refreshHeap();
                }
            }
        };

        var wasmUrl = config.locateFile ? config.locateFile('zstd.wasm.wasm') : 'zstd.wasm.wasm';

        return fetch(wasmUrl)
        .then(function (response) {
            return response.arrayBuffer();
        })
        .then(function (bytes) {
            return WebAssembly.instantiate(bytes, imports);
        })
        .then(function (result) {
            instance = result.instance;
            refreshHeap();

            return {
                decompress: function (src, decompressedSize) {
                    var exports = instance.exports;

                    // copy compressed data into wasm memory
                    var srcPtr = exports.malloc(src.byteLength);
                    heap.set(src, srcPtr);

                    // decompress
                    var dstPtr = exports.malloc(decompressedSize);
                    var size = exports.ZSTD_decompress(dstPtr, decompressedSize, srcPtr, src.byteLength);
                    var error = exports.ZSTD_isError(size);
                    var data = error ? null : heap.slice(dstPtr, dstPtr + size);

                    exports.free(srcPtr);
                    exports.free(dstPtr);

                    if (error) {
                        throw new Error('ZstdDecoderModule: failed to decompress data');
                    }
                    return data;
                }
            };
        })
        .catch(function (err) {
            if (config.onAbort) {
                config.onAbort(err);
            }
            throw err;
        });
    }

    window.ZstdDecoderModule = ZstdDecoderModule;
})();
