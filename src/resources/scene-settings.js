Object.assign(pc, function () {
    'use strict';

    var SceneSettingsHandler = function (app) {
        this._app = app;
    };

    Object.assign(SceneSettingsHandler.prototype, {
        load: function (url, callback) {
            if (typeof url === 'string') {
                url = {
                    load: url,
                    original: url
                };
            }

            pc.http.get(url.load, function (err, response) {
                if (!err) {
                    callback(null, response);
                } else {
                    callback("Error requesting scene: " + url.original);
                }
            });
        },

        open: function (url, data) {
            return data.settings;
        }
    });

    return {
        SceneSettingsHandler: SceneSettingsHandler
    };
}());
