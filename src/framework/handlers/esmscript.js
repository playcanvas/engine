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

    // eslint-disable-next-line multiline-comment-style
    /* #if _ASSET_BASE_URL
    const path = new URL(`${app.assets.prefix}.${moduleSpecifier}`, $_ASSET_BASE_URL).toString();
    // #else */
    const path = moduleSpecifier;
    // #endif

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

        DynamicImport(this._app, url.load).then(({ default: module }) => {
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
