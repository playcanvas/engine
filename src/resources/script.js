import { script } from '../framework/script.js';

/**
 * @class
 * @name ScriptHandler
 * @implements {pc.ResourceHandler}
 * @classdesc Resource handler for loading JavaScript files dynamically
 * Two types of JavaScript files can be loaded, PlayCanvas scripts which contain calls to {@link createScript},
 * or regular JavaScript files, such as third-party libraries.
 * @param {Application} app - The running {@link Application}.
 */
class ScriptHandler {
    constructor(app) {
        this._app = app;
        this._scripts = { };
        this._cache = { };
    }

    static _types = [];

    static _push(Type) {
        if (script.legacy && ScriptHandler._types.length > 0) {
            console.assert("Script Ordering Error. Contact support@playcanvas.com");
        } else {
            ScriptHandler._types.push(Type);
        }
    }

    load(url, callback) {
        // Scripts don't support bundling since we concatenate them. Below is for consistency.
        if (typeof url === 'string') {
            url = {
                load: url,
                original: url
            };
        }

        var self = this;
        script.app = this._app;

        this._loadScript(url.load, function (err, url, extra) {
            if (!err) {
                if (script.legacy) {
                    var Type = null;
                    // pop the type from the loading stack
                    if (ScriptHandler._types.length) {
                        Type = ScriptHandler._types.pop();
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
                    var obj = { };

                    for (var i = 0; i < ScriptHandler._types.length; i++)
                        obj[ScriptHandler._types[i].name] = ScriptHandler._types[i];

                    ScriptHandler._types.length = 0;

                    callback(null, obj, extra);

                    // no cache for scripts
                    delete self._loader._cache[url + 'script'];
                }
            } else {
                callback(err);
            }
        }.bind(this));
    }

    open(url, data) {
        return data;
    }

    patch(asset, assets) { }

    _loadScript(url, callback) {
        var head = document.head;
        var element = document.createElement('script');
        this._cache[url] = element;

        // use async=false to force scripts to execute in order
        element.async = false;

        element.addEventListener('error', function (e) {
            callback("Script: " + e.target.src + " failed to load");
        }, false);

        var done = false;
        element.onload = element.onreadystatechange = function () {
            if (!done && (!this.readyState || (this.readyState == "loaded" || this.readyState == "complete"))) {
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
