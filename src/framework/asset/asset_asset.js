pc.extend(pc.fw, function () {
    var Asset = function (resource_id, data, resource) {
        this.resourceId = resource_id;
        pc.extend(this, data);
        this._resource = resource;
    };
    
    Asset.prototype.getFileUrl = function () {
        var url = this.file.url;
        var prefix = "";
        // Non-exported files use the Corazon API to load, so they need an added prefix
        if (this.prefix) {
            prefix = this.prefix;
        }
        return pc.path.join(prefix, url);
    };
    
    Asset.prototype.getSubAssetFileUrl = function (i) {
        var url = this.subasset_files[i].url;
        var prefix = "";
        // Non-exported files use the Corazon API to load, so they need an added prefix
        if (this.prefix) {
            prefix = this.prefix;
        }
        return pc.path.join(prefix, url);
    };

    return {
        Asset: Asset
    }
}());
