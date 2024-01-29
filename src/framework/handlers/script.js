import { platform } from '../../core/platform.js';
import { script } from '../script.js';
import { ScriptType } from '../script/script-type.js';
import { ScriptTypes } from '../script/script-types.js';
import { registerScript } from '../script/script.js';
import { ResourceLoader } from './loader.js';

/** @typedef {import('./handler.js').ResourceHandler} ResourceHandler */

/**
 * Resource handler for loading JavaScript files dynamically.  Two types of JavaScript files can be
 * loaded, PlayCanvas scripts which contain calls to {@link createScript}, or regular JavaScript
 * files, such as third-party libraries.
 *
 * @implements {ResourceHandler}
 * @category Script
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

    clearCache() {
        for (const key in this._cache) {
            const element = this._cache[key];
            const parent = element.parentNode;
            if (parent)
                parent.removeChild(element);
        }
        this._cache = {};
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

        const onScriptLoad = (url.load, (err, url, extra) => {
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
                    delete self._loader._cache[ResourceLoader.makeKey(url, 'script')];
                }
            } else {
                callback(err);
            }
        });

        // check if we're loading a module or a classic script
        const [basePath, search] = url.load.split('?');
        const isEsmScript = basePath.endsWith('.mjs');

        if (isEsmScript) {

            // The browser will hold its own cache of the script, so we need to bust it
            let path = url.load;
            if (path.startsWith(this._app.assets.prefix)) {
                path = path.replace(this._app.assets.prefix, '');
            }

            const hash = this._app.assets.getByUrl(path).file.hash;
            const searchParams = new URLSearchParams(search);
            searchParams.set('hash', hash);
            const urlWithHash = `${basePath}?${searchParams.toString()}`;

            this._loadModule(urlWithHash, onScriptLoad);
        } else {
            this._loadScript(url.load, onScriptLoad);
        }
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

    _loadModule(url, callback) {

        // if we're in the browser, we need to use the full URL
        const baseUrl = platform.browser ? window.location.origin : import.meta.url;
        const importUrl = new URL(url, baseUrl);

        // @ts-ignore
        import(importUrl.toString()).then((module) => {

            for (const key in module) {
                const scriptClass = module[key];
                const extendsScriptType = scriptClass.prototype instanceof ScriptType;

                if (extendsScriptType) {

                    if (script.attributesDefinition) {
                        for (const key in script.attributesDefinition) {
                            scriptClass.attributes.add(key, script.attributesDefinition[key]);
                        }
                    }

                    registerScript(scriptClass, scriptClass.name);
                }
            }

            callback(null, url, null);

        }).catch((err) => {
            callback(err);
        });
    }
}

export { ScriptHandler };
