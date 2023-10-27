import { ResourceLoader } from './loader.js';

/** @typedef {import('./handler.js').ResourceHandler} ResourceHandler */

/**
 * Resource handler for dynamically importing script es modules.
 * @implements {ResourceHandler}
 */
class ScriptESMHandler {
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
    }

    clearCache() {
    }

    load(url, callback) {

        if (typeof url === 'string') {
            url = {
                load: url,
                original: url
            };
        }

        /* eslint-disable spaced-comment */
        // The following code is necessary to import ES modules with 'use_local_engine'
        /*#if _ASSET_BASE_URL
        const finalUrl = $_ASSET_BASE_URL +  url.load;
        //#else */
        const finalUrl = url.load;
        //#endif
        /* eslint-enable */

        import(finalUrl).then(({ default: module }) => {
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

export { ScriptESMHandler };
