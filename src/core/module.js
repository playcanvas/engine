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
    const loadUrl = (wasmSupported() && config.glueUrl && config.wasmUrl) ? config.glueUrl : config.fallbackUrl;
    if (loadUrl) {
        loadScript(loadUrl, (err) => {
            if (err) {
                callback(err, null);
            } else {
                window[moduleName]({
                    locateFile: () => config.wasmUrl
                }).then((instance) => {
                    callback(null, instance);
                });
            }
        });
    } else {
        callback('No supported wasm modules found.', null);
    }
};

// get state object for the named module
const getModule = (() => {
    const modules = {};
    return (name) => {
        if (!modules.hasOwnProperty(name)) {
            modules[name] = {
                config: null,
                initializing: false,
                instance: null,
                error: null,
                callbacks: []
            };
        }
        return modules[name];
    };
})();

const initialize = (moduleName, module) => {
    if (module.initializing) {
        return;
    }

    const config = module.config;

    if (config.glueUrl || config.wasmUrl || config.fallbackUrl) {
        module.initializing = true;
        loadWasm(moduleName, config, (err, instance) => {
            if (err) {
                console.error(`failed to initialize module=${moduleName} error=${err}`);
            }
            module.error = err;
            module.instance = instance;
            module.callbacks.forEach((callback) => {
                callback(err, instance);
            });
        });
    }
};

/**
 * Callback used by {@link Module#getInstance}.
 *
 * @callback ModuleInstanceCallback
 * @param {string} error - If the instance fails to load this will contain a description of the error.
 * @param {any} moduleInstance - The module instance.
 */

class Module {
    /**
     * Set a module's URL configuration.
     *
     * @param {string} moduleName - Name of the module.
     * @param {object} [config] - The configuration object.
     * @param {string} [config.glueUrl] - URL of glue script.
     * @param {string} [config.wasmUrl] - URL of the wasm script.
     * @param {string} [config.fallbackUrl] - URL of the fallback script to use when wasm modules
     * aren't supported.
     */
    static setConfig(moduleName, config) {
        const module = getModule(moduleName);
        module.config = config;
        if (module.callbacks.length > 0) {
            // start module initialize immediately since there are pending getInstance requests
            initialize(moduleName, module);
        }
    }

    /**
     * Get a module instance. The instance will be created if necessary and returned
     * in the second parameter to callback.
     *
     * @param {string} moduleName - Name of the module.
     * @param {ModuleInstanceCallback} callback - The function called when the instance is
     * available.
     */
    static getInstance(moduleName, callback) {
        const module = getModule(moduleName);

        if (module.instance || module.error) {
            callback(module.error, module.instance);
        } else {
            module.callbacks.push(callback);
            if (module.config) {
                // config has been provided, kick off module initialize
                initialize(moduleName, module);
            }
        }
    }
}

export {
    Module
};
