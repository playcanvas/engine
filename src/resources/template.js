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

            var that = this;

            pc.http.get(url.load, function (err, response) {
                if (err) {
                    callback("Error requesting template: " + url.original);
                } else {
                    that._waitForDependencies(response, callback);
                }
            });
        },

        open: function (url, data) {
            return new pc.Template(this._app, data);
        },

        _waitForDependencies: function (response, callback) {
            var templateIds = pc.TemplateUtils.extractTemplateIds(response.entities);

            var loader = new pc.AssetListLoader(templateIds, this._app.assets);

            loader.load(function (err) {
                callback(err, response);
            });
        }
    });

    return {
        TemplateHandler: TemplateHandler
    };
}());
