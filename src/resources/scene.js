Object.assign(pc, function () {
    'use strict';

    /**
     * @class
     * @name pc.SceneHandler
     * @implements {pc.ResourceHandler}
     * @classdesc Resource handler used for loading {@link pc.Scene} resources
     * @param {pc.Application} app - The running {@link pc.Application}
     */
    var SceneHandler = function (app) {
        this._app = app;
        this.retryRequests = false;
    };

    Object.assign(SceneHandler.prototype, {
        load: function (url, callback) {
            if (typeof url === 'string') {
                url = {
                    load: url,
                    original: url
                };
            }

            var assets = this._app.assets;

            pc.http.get(url.load, {
                retry: this.retryRequests
            }, function (err, response) {
                if (!err) {
                    pc.TemplateUtils.waitForTemplatesInScene(
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

            var parser = new pc.SceneParser(this._app, false);
            var parent = parser.parse(data);

            // set scene root
            var scene = this._app.scene;
            scene.root = parent;

            this._app.applySceneSettings(data.settings);

            // re-enable script initialization
            this._app.systems.script.preloading = false;

            return scene;
        },

        patch: function (asset, assets) {
        }
    });

    return {
        SceneHandler: SceneHandler
    };
}());
