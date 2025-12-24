import { platform } from '../../core/platform.js';
import { Debug } from '../../core/debug.js';
import { script } from '../script.js';
import { ScriptTypes } from '../script/script-types.js';
import { registerScript } from '../script/script-create.js';
import { ResourceLoader } from './loader.js';
import { ResourceHandler } from './handler.js';
import { Script } from '../script/script.js';

/**
 * @import { AppBase } from '../app-base.js'
 */

const toLowerCamelCase = str => str[0].toLowerCase() + str.substring(1);

/**
 * Resource handler for loading JavaScript files dynamically.  Two types of JavaScript files can be
 * loaded, PlayCanvas scripts which contain calls to {@link createScript}, or regular JavaScript
 * files, such as third-party libraries.
 *
 * @category Script
 */
class ScriptHandler extends ResourceHandler {
    /**
     * Create a new ScriptHandler instance.
     *
     * @param {AppBase} app - The running {@link AppBase}.
     * @ignore
     */
    constructor(app) {
        super(app, 'script');

        this._scripts = { };
        this._cache = { };
    }

    clearCache() {
        for (const key in this._cache) {
            const element = this._cache[key];
            const parent = element.parentNode;
            if (parent) {
                parent.removeChild(element);
            }
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
                const obj = { };

                for (let i = 0; i < ScriptTypes._types.length; i++) {
                    obj[ScriptTypes._types[i].name] = ScriptTypes._types[i];
                }

                ScriptTypes._types.length = 0;

                callback(null, obj, extra);

                // no cache for scripts
                const urlWithoutEndHash = url.split('&hash=')[0];
                delete self._loader._cache[ResourceLoader.makeKey(urlWithoutEndHash, 'script')];
            } else {
                callback(err);
            }
        });

        // check if we're loading a module or a classic script
        const [basePath] = url.load.split('?');
        const isEsmScript = basePath.endsWith('.mjs');

        if (isEsmScript) {
            this._loadModule(basePath, onScriptLoad);
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

        element.addEventListener('error', (e) => {
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
        const isBrowserWithOrigin = platform.browser && window.location.origin !== 'null';
        const baseUrl = isBrowserWithOrigin ? window.location.origin + window.location.pathname : import.meta.url;
        const importUrl = new URL(url, baseUrl);

        // @ts-ignore
        import(importUrl.toString()).then((module) => {

            const filename = importUrl.pathname.split('/').pop();
            const scriptSchema = this._app.assets.find(filename, 'script')?.data?.scripts;

            for (const key in module) {
                const scriptClass = module[key];
                const extendsScriptType = scriptClass.prototype instanceof Script;

                if (extendsScriptType) {

                    const lowerCamelCaseName = toLowerCamelCase(scriptClass.name);

                    if (!scriptClass.scriptName) {
                        Debug.warnOnce(`The Script class "${scriptClass.name}" must have a static "scriptName" property: \`${scriptClass.name}.scriptName = "${lowerCamelCaseName}";\`. This will be an error in future versions of PlayCanvas.`);
                    }

                    const scriptName = scriptClass.scriptName ?? lowerCamelCaseName;

                    // Register the script name
                    registerScript(scriptClass, scriptName);

                    // Store any schema associated with the script
                    if (scriptSchema) this._app.scripts.addSchema(scriptName, scriptSchema[scriptName]);
                }
            }

            callback(null, url, null);

        }).catch((err) => {
            callback(err);
        });
    }
}

export { ScriptHandler };
