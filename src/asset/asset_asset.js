/**
* @name pc.asset
* @namespace Contains classes related to Assets.
*/
pc.asset = {};
pc.extend(pc.asset, function () {
    /**
    * @name pc.asset.Asset
    * @class An asset record that can be loaded by the engine. Aside from detail like resourceId and name,
    * the asset class contains one or both of 'file' and 'data' properties.
    * 'file' contains the details of the file to load (filename, url), 'data' contains a JSON blob which
    * contains either more information about the file or the actual asset data itself.
    * @constructor Create a new Asset record. Generaly, Assets are created in the Pack loading process and you won't need to create them by hand.
    * @param {String} name A non-unique but human-readable name which can be later used to retrieve the asset.
    * @param {String} type Type of asset. One of ["animation", "audio", "image", "json", "material", "model", "text", "texture"]
    * @param {Object} file Details about the file the asset is made from. For assets that don't contain file data use null.
    * @example
    * var file = {
    *   filename: "filename.txt",
    *   url: "/example/filename.txt",
    * }
    * @param {Object} [data] JSON object with additional data about the asset (e.g. for texture and model assets) or contains the asset data itself (e.g. in the case of materials)
    * @param {String} [prefix] URL prefix to prepend to the file URL when return getFileUrl()
    * @example
    * var asset = new pc.Asset("a texture", pc.asset.ASSET_TEXTURE, {
    *        filename: "texture.png",
    *        url: "http://example.com/my/assets/here/texture.png"
    *    });
    */
    var Asset = function (name, type, file, data, prefix) {
        var file, data, prefix; // optional arguments

        this.resourceId = pc.guid.create();

        this.name = arguments[0];
        this.type = arguments[1];
        this.file = arguments[2] ? {
            filename: file.filename,
            size: file.size,
            hash: file.hash,
            url: file.url
        } : null;
        // if (this.file && !this.file.hash) {
        //     // if there is no hash use the URL
        //     this.file.hash = this.file.url;
        // }
        this.data = arguments[3] || {};
        this.prefix = arguments[4] || "";

        // This is where the loaded resource will be
        this.resource = null;

        pc.events.attach(this);
    };


    Asset.prototype = {
        /**
        * @name pc.asset.Asset#getFileUrl
        * @function
        * @description Return the URL required to fetch the file for this asset.
        * @returns {String} The URL
        * @example
        * var assets = context.assets.find("My Image", pc.asset.ASSET_IMAGE);
        * var img = "<img src='" + assets[0].getFileUrl() + "'></img>";
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
        ASSET_ANIMATION: 'animation',
        ASSET_AUDIO: 'audio',
        ASSET_IMAGE: 'image',
        ASSET_JSON: 'json',
        ASSET_MODEL: 'model',
        ASSET_MATERIAL: 'material',
        ASSET_TEXT: 'text',
        ASSET_TEXTURE: 'texture'
    };
}());
