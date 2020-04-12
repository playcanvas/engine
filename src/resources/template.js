Object.assign(pc, function () {
    'use strict';

    var TemplateHandler = function (app) {
        this._app = app;
    };

    Object.assign(TemplateHandler.prototype, {
        load: function (url, callback) {
            if (typeof url === 'string') {
                url = {
                    load: url,
                    original: url
                };
            }

            var assets = this._app.assets;

            pc.http.get(url.load, function (err, response) {
                if (err) {
                    callback("Error requesting template: " + url.original);
                } else {
                    pc.TemplateUtils.waitForTemplateAssets(
                        response.entities,
                        assets,
                        callback,
                        response);
                }
            });
        },

        open: function (url, data) {
            return new pc.Template(this._app, data);
        }
    });

    return {
        TemplateHandler: TemplateHandler
    };
}());
