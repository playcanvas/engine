pc.extend(pc, function () {
    'use strict';

    var ResourceLoader = function () {
        this._handlers = {};
        this._requests = {};
        this._cache = {};
    };

    ResourceLoader.prototype = {
        addHandler: function (type, handler) {
            this._handlers[type] = handler;
        },

        load: function(url, type, callback) {
            var handler = this._handlers[type];
            if (!handler) {
                var err = "No handler for asset type: " + type;
                callback(err);
                return;
            }

            var key = url + type;

            if (this._cache[key]) {
                // in cache
                callback(null, this._cache[key]);
            } else if (this._requests[key]) {
                // existing request
                this._requests[key].push(callback);
            } else {
                // new request
                this._requests[key] = [callback];
                handler.load(url, function (err, data) {
                    var i, len = this._requests[key].length;
                    if (!err) {
                        var resource = handler.open(url, data);
                        this._cache[key] = resource;
                        for(var i = 0; i < len; i++) {
                            this._requests[key][i](null, resource);
                        }
                    } else {
                        for(var i = 0; i < len; i++) {
                            this._requests[key][i](err);
                        }
                    }
                    delete this._requests[key];
                }.bind(this));
            }
        },

        open: function (type, data) {
            var handler = this._handlers[type];
            return handler.open(null, data);
        },

        patch: function (asset, assets) {
            var handler = this._handlers[asset.type];
            if (handler.patch) {
                handler.patch(asset, assets);
            }
        },

        addToCache: function (key, resource) {

        },

        removeFromCache: function (key) {

        },

        getFromCache: function (url, type) {
            if (this._cache[url + type]) {
                return this._cache[url + type];
            }
        }
    };

    return {
        ResourceLoader: ResourceLoader
    }
}());
