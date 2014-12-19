pc.extend(pc.resources, function () {
    /**
    * @name pc.resources.TextureCache
    * @class Cache textures to prevent multiple instances being created between models
    * Uses file hashes to determine if a texture is already loaded
    * @param {pc.resources.ResourceLoader} loader The loader used to get Assets for the application
    */
    var TextureCache = function (loader) {
        this.cache = {};
        this.loader = loader;
    };

    TextureCache.prototype = {
        /**
        * @function
        * @name pc.resources.TextureCache#getTexture
        * @description Get a texture from the cache if it is there
        * @param {String} url The url of the image for the texture
        * @returns {pc.Texture} The texture from the cache or null
        */
        getTexture: function (url) {
            var hash = this.loader.getHash(url);

            if (hash && this.cache[hash]) {
                return this.cache[hash];
            }

            return null;
        },

        /**
        * @function
        * @name pc.resources.TextureCache#addTexture
        * @description Add a texture to the cache
        * @param {String} url The url of the texture being cached
        * @param {pc.Texture} texture The texture object to cache
        */
        addTexture: function (url, texture) {
            var hash = this.loader.getHash(url);
            if (hash) {
                this.cache[hash] = texture;    
            }
        }
    };

    return {
        TextureCache: TextureCache
    };

}() );