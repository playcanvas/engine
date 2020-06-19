import { http } from '../net/http.js';

import { SceneParser } from './parser/scene.js';

import { TemplateUtils } from '../templates/template-utils.js';

function HierarchyHandler(app) {
    this._app = app;
    this.retryRequests = false;
}

Object.assign(HierarchyHandler.prototype, {
    load: function (url, callback) {
        if (typeof url === 'string') {
            url = {
                load: url,
                original: url
            };
        }

        var assets = this._app.assets;

        http.get(url.load, {
            retry: this.retryRequests
        }, function (err, response) {
            if (!err) {
                TemplateUtils.waitForTemplatesInScene(
                    response,
                    assets,
                    callback);
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
    },

    open: function (url, data) {
        // prevent script initialization until entire scene is open
        this._app.systems.script.preloading = true;

        var parser = new SceneParser(this._app, false);
        var parent = parser.parse(data);

        // re-enable script initialization
        this._app.systems.script.preloading = false;

        return parent;
    }
});

export { HierarchyHandler };
