/**
 * Represents the resource of a Bundle Asset, which contains an index that maps URLs to blob URLs.
 *
 * @ignore
 */
class Bundle {
    /**
     * Create a new Bundle instance.
     *
     * @param {object[]} files - An array of objects that have a name field and contain a
     * getBlobUrl() function.
     */
    constructor(files) {
        this._blobUrls = {};

        for (let i = 0, len = files.length; i < len; i++) {
            if (files[i].url) {
                this._blobUrls[files[i].name] = files[i].url;
            }
        }
    }

    /**
     * Returns true if the specified URL exists in the loaded bundle.
     *
     * @param {string} url - The original file URL. Make sure you have called decodeURIComponent on
     * the URL first.
     * @returns {boolean} True of false.
     */
    hasBlobUrl(url) {
        return !!this._blobUrls[url];
    }

    /**
     * Returns a blob URL for the specified URL.
     *
     * @param {string} url - The original file URL. Make sure you have called decodeURIComponent on
     * the URL first.
     * @returns {string} A blob URL.
     */
    getBlobUrl(url) {
        return this._blobUrls[url];
    }

    /**
     * Destroys the bundle and frees up blob URLs.
     */
    destroy() {
        for (const key in this._blobUrls) {
            URL.revokeObjectURL(this._blobUrls[key]);
        }
        this._blobUrls = null;
    }
}

export { Bundle };
