import { http } from '../net/http.js';

import { SceneParser } from './parser/scene.js';

import { TemplateUtils } from '../templates/template-utils.js';

/**
 * @class
 * @name SceneHandler
 * @implements {ResourceHandler}
 * @classdesc Resource handler used for loading {@link Scene} resources.
 * @param {Application} app - The running {@link Application}.
 */
class SceneHandler {
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
    }

    open(url, data) {
        // prevent script initialization until entire scene is open
        this._app.systems.script.preloading = true;

        var parser = new SceneParser(this._app, false);
        var parent = parser.parse(data);

        // set scene root
        var scene = this._app.scene;
        scene.root = parent;

        this._app.applySceneSettings(data.settings);

        // re-enable script initialization
        this._app.systems.script.preloading = false;

        return scene;
    }

    patch(asset, assets) {
    }
}

export { SceneHandler };
