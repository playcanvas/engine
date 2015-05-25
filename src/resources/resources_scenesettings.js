pc.extend(pc, function () {
    'use strict';

    var SceneSettingsHandler = function (app) {
        this._app = app;
    };

    SceneSettingsHandler.prototype = {
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
            return data.settings;
        }
    };

    return {
        SceneSettingsHandler: SceneSettingsHandler
    }
}());
