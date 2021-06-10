/* eslint-disable no-unused-vars */

// check for wasm module support
export function wasmSupported() {
    try {
        if (typeof WebAssembly === "object" && typeof WebAssembly.instantiate === "function") {
            const module = new WebAssembly.Module(Uint8Array.of(0x0, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00));
            if (module instanceof WebAssembly.Module)
                return new WebAssembly.Instance(module) instanceof WebAssembly.Instance;
        }
    } catch (e) { }
    return false;
}

// load a script
export function loadScriptAsync(url, doneCallback) {
    var tag = document.createElement('script');
    tag.onload = function () {
        doneCallback();
    };
    tag.onerror = function () {
        throw new Error('failed to load ' + url);
    };
    tag.async = true;
    tag.src = url;
    document.head.appendChild(tag);
}

// load and initialize a wasm module
export function loadWasmModuleAsync(moduleName, jsUrl, binaryUrl, doneCallback) {
    loadScriptAsync(jsUrl, function () {
        var lib = window[moduleName];
        window[moduleName + 'Lib'] = lib;
        lib({
            locateFile: function () {
                return binaryUrl;
            }
        }).then(function (instance) {
            window[moduleName] = instance;
            doneCallback();
        });
    });
}
