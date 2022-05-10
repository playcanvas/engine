
// returns true if the running host supports wasm modules (all browsers except IE)
const wasmSupported = () => {
    let supported = null;

    if (supported === null) {
        supported = (() => {
            try {
                if (typeof WebAssembly === "object" && typeof WebAssembly.instantiate === "function") {
                    const module = new WebAssembly.Module(Uint8Array.of(0x0, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00));
                    if (module instanceof WebAssembly.Module)
                        return new WebAssembly.Instance(module) instanceof WebAssembly.Instance;
                }
            } catch (e) { }
            return false;
        })();
    }

    return supported;
};

// load a script
const loadScript = (url, callback) => {
    const s = document.createElement('script');
    s.setAttribute('src', url);
    s.onload = () => {
        callback(null);
    };
    s.onerror = () => {
        callback(`Failed to load script='${url}'`);
    };
    document.body.appendChild(s);
};

// load a wasm module
const loadWasm = (moduleName, config, callback) => {
    if (wasmSupported() && config.glueUrl && config.wasmUrl) {
        loadScript(config.glueUrl, (err) => {
            if (err) {
                callback(err);
            } else {
                window[moduleName]({
                    locateFile: () => config.wasmUrl
                }).then((instance) => {
                    callback(null, instance);
                });
            }
        });
    } else if (config.fallbackUrl) {
        loadScript(config.fallbackUrl, callback);
    } else {
        callback('No supported wasm modules found.');
    }
};

// get state object for the named module
const getModule = (() => {
    const modules = {};
    return (name) => {
        if (!modules.hasOwnProperty(name)) {
            modules[name] = {
                lazyConfig: null,
                initializing: false,
                instance: null,
                callbacks: []
            };
        }
        return modules[name];
    };
})();

/**
 * Callback used by {@link Module#getInstance}.
 *
 * @callback ModuleInstanceCallback
 * @param {any} moduleInstance - The module instance.
 */

class Module {
    /**
     * Initialize a wasm module
     *
     * @param {string} moduleName - Name of the module.
     * @param {object} [config] - The configuration object.
     * @param {string} [config.glueUrl] - URL of glue script.
     * @param {string} [config.wasmUrl] - URL of the wasm script.
     * @param {string} [config.fallbackUrl] - URL of the fallback script to use when wasm modules
     * aren't supported.
     * @param {boolean} [config.lazyInit] - Wait for first access request before initializing the module
     * (default is false). Otherwise initialize the module immediately.
     */
    static initialize(moduleName, config) {
        const module = getModule(moduleName);

        if (module.initializing) {
            return;
        }

        if (!config) {
            config = module.lazyConfig || {};
        } else if (config.lazyInit) {
            module.lazyConfig = config;
            return;
        }

        if (config.glueUrl || config.wasmUrl || config.fallbackUrl) {
            module.initializing = true;
            loadWasm(moduleName, config, (err, instance) => {
                if (err) {
                    console.error(`failed to initialize ${moduleName} module: ${err}`);
                } else {
                    module.instance = instance;
                    module.callbacks.forEach(callback => {
                        callback(instance);
                    });
                }
            });
        }
    }

    /**
     * Get a module instance. The instance will be created if necessary and returned
     * in the first parameter to callback.
     *
     * @param {string} moduleName - Name of the module.
     * @param {ModuleInstanceCallback} callback - The function called when the instance is
     * available.
     */
    static getInstance(moduleName, callback) {
        const module = getModule(moduleName);

        if (module.instance) {
            callback(module.instance);
        } else {
            if (!module.initializing) {
                Module.initialize(moduleName);
            }
            module.callbacks.push(callback);
        }
    }
}

export {
    Module
};
