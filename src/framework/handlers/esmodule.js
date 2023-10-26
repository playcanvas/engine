import { ResourceLoader } from './loader.js';

/** @typedef {import('./handler.js').ResourceHandler} ResourceHandler */

const ASSET_BASE_URL = '';

/**
 * Resource handler for loading JavaScript files dynamically.  Two types of JavaScript files can be
 * loaded, PlayCanvas scripts which contain calls to {@link createScript}, or regular JavaScript
 * files, such as third-party libraries.
 *
 * @implements {ResourceHandler}
 */
class EsModuleHandler {
    /**
     * Type of the resource the handler handles.
     *
     * @type {string}
     */
    handlerType = "esmodule";

    /**
     * Create a new ScriptHandler instance.
     *
     * @param {import('../app-base.js').AppBase} app - The running {@link AppBase}.
     * @hideconstructor
     */
    constructor(app) {
        this._app = app;
        this._scripts = { };
        // this._cache = { };
    }

    clearCache() {
        // for (const key in this._cache) {
            // const element = this._cache[key];
            // const parent = element.parentNode;
            // if (parent)
            //     parent.removeChild(element);
        // }
        // this._cache = {};
    }

    load(url, callback) {

        if (typeof url === 'string') {
            url = {
                load: url,
                original: url
            };
        }

        console.log(ASSET_BASE_URL + url.load);
        import(ASSET_BASE_URL + url.load).then(({ default: module }) => {
            callback(null, module, url);
            delete this._loader._cache[ResourceLoader.makeKey(url, 'esmodule')];
        }).catch((err) => {
            callback(err);
        });

    }

    open(url, data) {
        return data;
    }

    patch(asset, assets) { }
}

export { EsModuleHandler };
