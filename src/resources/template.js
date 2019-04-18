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

            pc.http.get(url.load, function (err, response) {
                if (!err) {
                    callback(null, response);
                } else {
                    callback("Error requesting template: " + url.original);
                }

            });
        },

        // what this returns becomes .resource of the asset
        // returned by app.assets.loadFromUrl
        open: function (url, data) {
            return new pc.Template(this._app, data);
        }
    });

    return {
        TemplateHandler: TemplateHandler
    };
}());
