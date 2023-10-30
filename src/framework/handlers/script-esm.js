/**
 * This custom import statement for ES Modules conditionally
 * checks and resolves modules in bundled or non bundled modules
 *
 * @param {import('../../framework/app-base').AppBase} app - The application scope to load from.
 * @param {string} moduleSpecifier - The raw model data.
 * @returns {Promise} Returns a promise which fulfills to a module namespace object: an object containing all exports from moduleName.
 */
export const pcImport = (app, moduleSpecifier) => {
    // TODO: handle bundled contexts correctly
    return import(moduleSpecifier);
};

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

        // eslint-disable-next-line multiline-comment-style
        /* #if _ASSET_BASE_URL
        finalUrl = $_ASSET_BASE_URL + url.load;
        // #else */
        const finalUrl = url.load;
        // #endif

        pcImport(this._app, finalUrl).then(({ default: module }) => {
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
