/**
 * @private
 * @class
 * @name AssetFile
 * @classdesc Wraps a source of asset data.
 */
class AssetFile {
    constructor(url, filename, hash, size, opt, contents) {
        this.url = url || '';
        this.filename = filename || '';
        this.hash = hash || null;
        this.size = size || null;
        this.opt = opt || null;
        this.contents = contents || null;
    }

    // Compare this AssetFile with another. Returns true if they have the same data
    // and false otherwise.
    cmp(other) {
        return this.url === other.url &&
            this.filename === other.filename &&
            this.hash === other.hash &&
            this.size === other.size &&
            this.opt === other.opt &&
            this.contents === other.contents;
    }
}

export {
    AssetFile
};
