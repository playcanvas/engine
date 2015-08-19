pc.extend(pc, function () {
    'use strict';

    var SceneHandler = function (app) {
        this._app = app;
    };

    SceneHandler.prototype = {
        load: function (url, callback) {
            pc.net.http.get(url, function (response) {
                callback(null, response);
            }, {
                error: function (status, xhr, e) {
                    callback("Error requesting scene: " + url);
                }
            });
        },

        open: function (url, data) {
            // prevent script initialization until entire scene is open
            this._app.systems.script.preloading = true;

            var scene = new pc.Scene();
            this._app.scene = scene;

            var parser = new pc.SceneParser(this._app);
            var parent = parser.parse(data);

            // set scene root
            scene.root = parent;

            this._app.applySceneSettings(data.settings);

            // re-enable script initialization
            this._app.systems.script.preloading = false;

            return scene;
        },

        patch: function (asset, assets) {
        }
    };

    return {
        SceneHandler: SceneHandler
    }
}());
