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

            var app = this._app;

            pc.http.get(url.load, function (err, response) {
                if (err) {
                    callback("Error requesting template: " + url.original);
                } else {
                    new pc.LoadDependencies(app, response, callback).run();
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
