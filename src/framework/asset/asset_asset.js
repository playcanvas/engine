pc.extend(pc.fw, function () {
    var Asset = function (resource_id, data, prefix) {
        this.resourceId = resource_id;
        pc.extend(this, data);
        pc.extend(this, pc.events);
        this.prefix = prefix || "";
    };
    
    Asset.prototype.getFileUrl = function () {
        if (!this.file) {
            return null;
        }

        var url = this.file.url;
        var prefix = "";
        // Non-exported files use the Corazon API to load, so they need an added prefix
        if (this.prefix) {
            prefix = this.prefix;
        }
        return pc.path.join(prefix, url);
    };
    
    // Asset.prototype.getSubAssetFileUrl = function (i) {
    //     var url = this.subfiles[i].url;
    //     var prefix = "";
    //     // Non-exported files use the Corazon API to load, so they need an added prefix
    //     if (this.prefix) {
    //         prefix = this.prefix;
    //     }
    //     return pc.path.join(prefix, url);
    // };

    return {
        Asset: Asset,
        ASSET_TYPE_ANIMATION: 'animation',
        ASSET_TYPE_AUDIO: 'audio',
        ASSET_TYPE_IMAGE: 'image',
        ASSET_TYPE_JSON: 'json',
        ASSET_TYPE_MODEL: 'model',
        ASSET_TYPE_MATERIAL: 'material',
        ASSET_TYPE_TEXT: 'text',
        ASSET_TYPE_TEXTURE: 'texture'
    };
}());
