import { http } from '../net/http.js';

import { SceneParser } from './parser/scene.js';

class HierarchyHandler {
    constructor(app) {
        this._app = app;
        this.maxRetries = 0;
    }

    load(url, callback) {
        if (typeof url === 'string') {
            url = {
                load: url,
                original: url
            };
        }

        var assets = this._app.assets;

        http.get(url.load, {
            retry: this.maxRetries > 0,
            maxRetries: this.maxRetries
        }, function (err, response) {
            if (!err) {
                callback(err, response);
            } else {
                var errMsg = 'Error while loading scene ' + url.original;
                if (err.message) {
                    errMsg += ': ' + err.message;
                    if (err.stack) {
                        errMsg += '\n' + err.stack;
                    }
                } else {
                    errMsg += ': ' + err;
                }

                callback(errMsg);
            }
        });
    }

    open(url, data) {
        // prevent script initialization until entire scene is open
        this._app.systems.script.preloading = true;

        var parser = new SceneParser(this._app, false);
        var parent = parser.parse(data);

        // re-enable script initialization
        this._app.systems.script.preloading = false;

        return parent;
    }
}

export { HierarchyHandler };
