import { AssetRegistry } from '../asset/asset-registry.js';

export class ScriptCache {
    _scripts = new Map();

    register(path, script) {
        const url = URL.canParse(path) ? new URL(path) : new URL(path, 'file://');
        this._scripts.set(url.pathname, script);
    }

    get(path) {
        const url = URL.canParse(path) ? new URL(path) : new URL(path, 'file://');
        return this._scripts.get(url.pathname);
    }

    clear() {
        this._scripts.clear();
    }
}

/**
 * This custom import statement for ES Modules conditionally
 * checks and resolves modules in bundled or non bundled modules
 *
 * **The api is likely to change, use at your own discretion**
 *
 * @param {import('../app-base').AppBase} app - The application scope to load from.
 * @param {string} moduleSpecifier - A unique path or specifier used to import the module
 * @returns {Promise} Returns a promise which fulfills to a module namespace object: an object containing all exports from moduleName.
 *
 * @todo add support for bundle contexts
 * @ignore
 */
export const DynamicImport = (app, moduleSpecifier) => {

    // If the `AssetRegistry.assetBaseUrl` is defined, use it as the base URL for the import.
    const baseUrl = AssetRegistry?.assetBaseUrl ?? import.meta.url;
    const isFileProtocol = import.meta.resolve(moduleSpecifier).startsWith('file:');

    // If we are loading a local file, we don't need to append the baseUrl.
    const path = isFileProtocol ?
        moduleSpecifier :
        `${baseUrl}/${moduleSpecifier}`;

    return import(`${path}`);
};

/** @typedef {import('./handler.js').ResourceHandler} ResourceHandler */

/**
 * Resource handler for dynamically importing script es modules.
 * @implements {ResourceHandler}
 * @ignore
 */
class EsmScriptHandler {
    /**
     * Type of the resource the handler handles.
     *
     * @type {string}
     */
    handlerType = "esmscript";

    /**
     * Create a new ScriptHandler instance.
     *
     * @param {import('../app-base.js').AppBase} app - The running {@link AppBase}.
     * @hideconstructor
     */
    constructor(app) {
        this._app = app;
        this._scripts = { };
        this.cache = new ScriptCache();
    }

    clearCache() {
        this.cache.clear();
    }

    load(url, callback) {

        if (typeof url === 'string') {
            url = {
                load: url,
                original: url
            };
        }

        DynamicImport(this._app, url.load).then(({ default: module }) => {
            this.cache.register(url.load, module);
            callback(null, module, url);
        }).catch((err) => {
            callback(err);
        });

    }

    open(url, data) {
        return data;
    }

    patch(asset, assets) { }
}

export { EsmScriptHandler };
