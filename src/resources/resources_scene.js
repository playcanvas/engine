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

            scene.applySettings(data.settings);

            // re-enable script initialization
            this._app.systems.script.preloading = false;

            return scene;
        },

        patch: function (asset, assets) {
            var scene = asset.resource;

            var asset = assets.get(scene.skyboxAsset);

            if (asset) {
                asset.ready(function(asset) {
                    scene.attachSkyboxAsset(asset);

                    asset.on('change', this._onSkyBoxChanged, this);
                    asset.on('remove', this._onSkyBoxRemoved, this);
                });
                assets.load(asset);
            } else {
                assets.once("add:" + scene.skyboxAsset, function (asset) {
                    asset.ready(function (asset) {
                        scene.attachSkyboxAsset(asset);
                    });
                    assets.load(asset);
                });
            }
        }
    };

    return {
        SceneHandler: SceneHandler
    }
}());
