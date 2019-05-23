Object.assign(pc, function () {

    var LoadDependencies = function LoadDependencies(app, assetIds, callback) {
        this._app = app;
        this._assetIds = assetIds;
        this._callback = callback;

        this._numNeeded = 0;
    };

    LoadDependencies.prototype.run = function () {
        for (var i = 0; i < this._assetIds.length; i++) {
            this._handleAssetId(this._assetIds[i]);
        }

        this._callbackIfDone();
    };

    LoadDependencies.prototype._handleAssetId = function (id) {
        var asset = this._app.assets.get(id);

        if (!asset) {
            this._app.assets.on('add:' + id, this._onAssetAdd.bind(this));

            this._numNeeded++;

        } else if (!asset.resource) {
            this._app.assets.on('load:' + id, this._onAssetLoad.bind(this));

            this._app.assets.load(asset);

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
            this._callback();
        }
    };

    return {
        LoadDependencies: LoadDependencies
    };
}());
