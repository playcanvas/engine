import { script } from '../script.js';
import { ScriptTypes } from '../script/script-types.js';

/** @typedef {import('./handler.js').ResourceHandler} ResourceHandler */

/**
 * Resource handler for loading JavaScript files dynamically.  Two types of JavaScript files can be
 * loaded, PlayCanvas scripts which contain calls to {@link createScript}, or regular JavaScript
 * files, such as third-party libraries.
 *
 * @implements {ResourceHandler}
 */
class ScriptHandler {
    /**
     * Type of the resource the handler handles.
     *
     * @type {string}
     */
    handlerType = "script";

    /**
     * Create a new ScriptHandler instance.
     *
     * @param {import('../app-base.js').AppBase} app - The running {@link AppBase}.
     * @hideconstructor
     */
    constructor(app) {
        this._app = app;
        this._scripts = { };
        this._cache = { };
    }

    load(url, callback) {
        // Scripts don't support bundling since we concatenate them. Below is for consistency.
        if (typeof url === 'string') {
            url = {
                load: url,
                original: url
            };
        }

        const self = this;
        script.app = this._app;

        this._loadScript(url.load, (err, url, extra) => {
            if (!err) {
                if (script.legacy) {
                    let Type = null;
                    // pop the type from the loading stack
                    if (ScriptTypes._types.length) {
                        Type = ScriptTypes._types.pop();
                    }

                    if (Type) {
                        // store indexed by URL
                        this._scripts[url] = Type;
                    } else {
                        Type = null;
                    }

                    // return the resource
                    callback(null, Type, extra);
                } else {
                    const obj = { };

                    for (let i = 0; i < ScriptTypes._types.length; i++)
                        obj[ScriptTypes._types[i].name] = ScriptTypes._types[i];

                    ScriptTypes._types.length = 0;

                    callback(null, obj, extra);

                    // no cache for scripts
                    delete self._loader._cache[url + 'script'];
                }
            } else {
                callback(err);
            }
        });
    }

    open(url, data) {
        return data;
    }

    patch(asset, assets) { }

    _loadScript(url, callback) {
        const head = document.head;
        const element = document.createElement('script');
        this._cache[url] = element;

        // use async=false to force scripts to execute in order
        element.async = false;

        element.addEventListener('error', function (e) {
            callback(`Script: ${e.target.src} failed to load`);
        }, false);

        let done = false;
        element.onload = element.onreadystatechange = function () {
            if (!done && (!this.readyState || (this.readyState === 'loaded' || this.readyState === 'complete'))) {
                done = true; // prevent double event firing
                callback(null, url, element);
            }
        };
        // set the src attribute after the onload callback is set, to avoid an instant loading failing to fire the callback
        element.src = url;

        head.appendChild(element);
    }
}

export { ScriptHandler };
