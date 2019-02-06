Object.assign(pc, function () {
    'use strict';

    var HierarchyHandler = function (app) {
        this._app = app;
    };

    Object.assign(HierarchyHandler.prototype, {
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
            // prevent script initialization until entire scene is open
            this._app.systems.script.preloading = true;

            var parser = new pc.SceneParser(this._app);
            var parent = parser.parse(data);

            // re-enable script initialization
            this._app.systems.script.preloading = false;

            return parent;
        }
    });

    return {
        HierarchyHandler: HierarchyHandler
    };
}());
