/**
 * Wraps a source of asset data.
 *
 * @ignore
 */
class AssetFile {
    constructor(url = '', filename = '', hash = null, size = null, opt = null, contents = null) {
        this.url = url;
        this.filename = filename;
        this.hash = hash;
        this.size = size;
        this.opt = opt;
        this.contents = contents;
    }

    // Compare this AssetFile with another. Returns true if they have the same data
    // and false otherwise.
    equals(other) {
        return this.url === other.url &&
            this.filename === other.filename &&
            this.hash === other.hash &&
            this.size === other.size &&
            this.opt === other.opt &&
            this.contents === other.contents;
    }
}

export { AssetFile };
