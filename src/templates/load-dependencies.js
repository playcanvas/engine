Object.assign(pc, function () {

    var LoadDependencies = function LoadDependencies(app, json, callback) {
        this._app = app;
        this._json = json;
        this._callback = callback;

        this._numNeeded = 0;
    };

    LoadDependencies.prototype.run = function () {
        for (var guid in this._json.entities) {
            this._handleEntity(this._json.entities[guid]);
        }

        this._callbackIfDone();
    };

    LoadDependencies.prototype._handleEntity = function (entity) {
        var id = entity.template_id;

        if (id) {
            var asset = this._app.assets.get(id);

            this._handleAsset(asset, id);
        }
    };

    LoadDependencies.prototype._handleAsset = function (asset, id) {
        if (!asset) {
            this._app.assets.on('add:' + id, this._onAssetAdd.bind(this));

            this._numNeeded++;

        } else if (!asset.resource) {
            this._app.assets.on('load:' + id, this._onAssetLoad.bind(this));

            this._numNeeded++;
        }
    };

    LoadDependencies.prototype._onAssetAdd = function (asset) {
        if (asset.resource) {
            this._onAssetLoad(asset);
        } else {
            this._app.assets.on('load:' + asset.id, this._onAssetLoad.bind(this));
        }
    };

    LoadDependencies.prototype._onAssetLoad = function () {
        this._numNeeded--;

        this._callbackIfDone();
    };

    LoadDependencies.prototype._callbackIfDone = function () {
        if (this._numNeeded === 0) {
            this._callback(null, this._json);
        }
    };

    return {
        LoadDependencies: LoadDependencies
    };
}());
