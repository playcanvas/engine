pc.asset = {};
pc.extend(pc.asset, function () {
    /**
    * @name pc.asset.Asset
    * @class An asset record that can be loaded by the engine. Aside from detail like resourceId and name,
    * the asset class contains one or both of 'file' and 'data' properties. 
    * 'file' contains the details of the file to load (url, size, etc), 'data' contains a JSON blob which
    * contains either more information about the file or the actual asset data itself.
    * @constructor Create a new Asset record. Generaly, Assets are created in the Pack loading process and you won't need to create them by hand.
    * @param {String} resourceId The UUID of the asset if retrieved the PlayCanvas platform
    * @param {String} name A non-unique but human-readable name which can be later used to retrieve the asset.
    * @param {String} type Type of asset. One of ["animation", "audio", "image", "json", "material", "model", "text", "texture"]
    * @param {Object} file Details about the file the asset is made from. Contains properties: filename, url, size, hash.
    * @param {Object} data JSON object with additional data about the asset (e.g. for texture and model assets) or contains the asset data itself (e.g. in the case of materials)
    * @param {String} prefix URL prefix to prepend to the file URL when return getFileUrl()
    * @example
    * var asset = new pc.Asset("12341234-1234-1234-1234-123412341234", "a texture", pc.asset.ASSET_TYPE_TEXTURE, {
    *        filename: "texture.png",
    *        hash: "abcdef", // optional hash
    *        url: "http://example.com/my/assets/here/texture.png"
    *    });
    */
    /**
    * @name pc.asset.Asset^2
    * @class An asset record that can be loaded by the engine. Aside from detail like resourceId and name,
    * the asset class contains one or both of 'file' and 'data' properties. 
    * 'file' contains the details of the file to load (url, size, etc), 'data' contains a JSON blob which
    * contains either more information about the file or the actual asset data itself.
    * @constructor Shortform constructor to create a new Asset record. For this you only need supply a name, type and file details. 
    * Generally, Assets are created in the Pack loading process and you won't need to create your own.
    * A resourceId will be generated, data and prefix values will default to {} and "".
    * @param {String} name A non-unique but human-readable name which can be later used to retrieve the asset.
    * @param {String} type Type of asset. One of ["animation", "audio", "image", "json", "material", "model", "text", "texture"]
    * @param {Object} file Details about the file the asset is made from. Contains properties: filename, url, size, hash.
    * @example
    * var asset = new pc.Asset("a texture", pc.asset.ASSET_TYPE_TEXTURE, {
    *        filename: "texture.png",
    *        url: "http://example.com/my/assets/here/texture.png"
    *    });
    */    
    var Asset = function (resourceId, name, type, file, data, prefix) {
        var file, data, prefix; // optional arguments

        if (arguments.length === 3) {
            this.resourceId = pc.guid.create();
            this.name = arguments[0];
            this.type = arguments[1];
            file = arguments[2];
            this.file = {
                filename: file.filename,
                size: file.size,
                hash: file.hash,
                url: file.url
            }
            this.data = {};
            this.prefix = "";
        } else {
            this.resourceId = arguments[0];
            this.name = arguments[1];
            this.type = arguments[2];
            this.file = arguments[3] ? {
                filename: file.filename,
                size: file.size,
                hash: file.hash,
                url: file.url
            } : null;
            this.data = arguments[4] || {};
            this.prefix = arguments[5] || "";
        }

        pc.extend(this, pc.events);
    };
        

    Asset.prototype = {
        /**
        * @name pc.asset.Asset#getFileUrl
        * @function
        * @description Return the URL required to fetch the file for this asset.
        * @returns {String} The URL
        * @example
        * var asset = context.assets.getAsset("My Image");
        * var img = "<img src='" + asset.getFileUrl() + "'></img>";
        */
        getFileUrl: function () {
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
        }
    };

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
