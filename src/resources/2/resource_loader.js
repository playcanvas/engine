pc.extend(pc, function () {
    var ResourceLoader = function () {
        this._handlers = {};
        this._requests = {};
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

            var key = url+type;
            if (this._requests[key]) {
                // existing request
                this._requests[key].push(callback);
            } else {
                // new request
                this._requests[key] = [callback];
                handler.load(url, function (err, data) {
                    var i, len = this._requests[key].length;
                    if (!err) {
                        var resource = handler.open(url, data);
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
            handler.patch(asset, assets);
        }
    };

    return {
        ResourceLoader: ResourceLoader
    }
}());
