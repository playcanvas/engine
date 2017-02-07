pc.extend(pc, function () {
    'use strict';

    var SceneSettingsHandler = function (app) {
        this._app = app;
    };

    SceneSettingsHandler.prototype = {
        load: function (url, callback) {
            pc.http.get(url, function (err, response) {
                if (!err) {
                    callback(null, response);
                } else {
                    callback("Error requesting scene: " + url);
                }
            });
        },

        open: function (url, data) {
            return data.settings;
        }
    };

    return {
        SceneSettingsHandler: SceneSettingsHandler
    };
}());
