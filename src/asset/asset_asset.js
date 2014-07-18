/**
* @name pc.asset
* @namespace Contains classes related to Assets.
*/
pc.asset = {};
pc.extend(pc.asset, function () {
    /**
    * @name pc.asset.Asset
    * @class An asset record of a file or data resource that can be loaded by the engine.
    * The asset contains three important fields:
    *
    * * `file` contains the details of a file (filename, url) which contains the resource data, e.g. an image file for a texture asset
    * * `data` contains a JSON blob which contains either the resource data for the asset (e.g. material data) or additional data for the file (e.g. material mappings for a model)
    * * `resource` contains the final resource when it is loaded. (e.g. a {@link pc.scene.PhongMaterial} or a {@link pc.gfx.Texture})
    *
    * See the {@link pc.asset.AssetRegistry} for details on loading resources from assets.
    * @property {String} name The name of the asset
    * @property {String} type The type of the asset. One of ["animation", "audio", "image", "json", "material", "model", "text", "texture"]
    * @property {Object} [file] The file details
    * @property {String} [file.url] The URL of the resource file that contains the asset data
    * @property {String} [file.filename] The filename of the resource file
    * @property {Number} [file.size] The size of the resource file
    * @property {String} [file.hash] The MD5 hash of the resource file data and the Asset data field.
    * @property {Object} [data] JSON data that contains either the complete resource data (e.g. in the case of a material) or additional data (e.g. in the case of a model it contains mappings from mesh to material)
    * @property {Object} [resource] A reference to the resource when the asset is loaded. e.g. a {@link pc.gfx.Texture} or a {@link pc.scene.Model}
    * @constructor Create a new Asset record. Generally, Assets are created in the loading process and you won't need to create them by hand.
    * @param {String} name A non-unique but human-readable name which can be later used to retrieve the asset.
    * @param {String} type Type of asset. One of ["animation", "audio", "image", "json", "material", "model", "text", "texture"]
    * @param {Object} file Details about the file the asset is made from. At the least must contain the 'url' field. For assets that don't contain file data use null.
    * @example
    * var file = {
    *   filename: "filename.txt",
    *   url: "/example/filename.txt",
    * }
    * @param {Object} [data] JSON object with additional data about the asset (e.g. for texture and model assets) or contains the asset data itself (e.g. in the case of materials)
    * @param {String} [prefix] URL prefix to prepend to the file URL when return getFileUrl()
    * @example
    * var asset = new pc.Asset("a texture", pc.asset.ASSET_TEXTURE, {
    *     url: "http://example.com/my/assets/here/texture.png"
    * });
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
            // Non-exported files use the API to load, so they need an added prefix
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
