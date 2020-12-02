import { http } from '../net/http.js';

function SceneSettingsHandler(app) {
    this._app = app;
    this.maxRetries = 0;
}

Object.assign(SceneSettingsHandler.prototype, {
    load: function (url, callback) {
        if (typeof url === 'string') {
            url = {
                load: url,
                original: url
            };
        }

        http.get(url.load, {
            retry: this.maxRetries > 0,
            maxRetries: this.maxRetries
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

export { SceneSettingsHandler };
