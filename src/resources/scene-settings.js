Object.assign(pc, function () {
    'use strict';

    var SceneSettingsHandler = function (app) {
        this._app = app;
        this.retryRequests = false;
    };

    Object.assign(SceneSettingsHandler.prototype, {
        load: function (url, callback) {
            if (typeof url === 'string') {
                url = {
                    load: url,
                    original: url
                };
            }

            pc.http.get(url.load, {
                retry: this.retryRequests
            }, function (err, response) {
                if (!err) {
                    callback(null, response);
                } else {
                    var errMsg = 'Error while loading scene settings ' + url.original;
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
            return data.settings;
        }
    });

    return {
        SceneSettingsHandler: SceneSettingsHandler
    };
}());
