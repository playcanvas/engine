/**
 * @private
 * @class
 * @name pc.Bundle
 * @param {object[]} files - An array of objects that have a name field and contain a getBlobUrl() function.
 * @classdesc Represents the resource of a Bundle Asset, which contains an index that maps URLs to blob URLs.
 */
class Bundle {
    constructor(files) {
        this._blobUrls = {};

        for (var i = 0, len = files.length; i < len; i++) {
            if (files[i].url) {
                this._blobUrls[files[i].name] = files[i].url;
            }
        }
    }

    /**
     * @private
     * @function
     * @name pc.Bundle#hasBlobUrl
     * @description Returns true if the specified URL exists in the loaded bundle.
     * @param {string} url - The original file URL. Make sure you have called decodeURIComponent on the URL first.
     * @returns {boolean} True of false.
     */
    hasBlobUrl(url) {
        return !!this._blobUrls[url];
    }

    /**
     * @private
     * @function
     * @name pc.Bundle#getBlobUrl
     * @description Returns a blob URL for the specified URL.
     * @param {string} url - The original file URL. Make sure you have called decodeURIComponent on the URL first.
     * @returns {string} A blob URL.
     */
    getBlobUrl(url) {
        return this._blobUrls[url];
    }

    /**
     * @private
     * @function
     * @name pc.Bundle#destroy
     * @description Destroys the bundle and frees up blob URLs.
     */
    destroy() {
        for (var key in this._blobUrls) {
            URL.revokeObjectURL(this._blobUrls[key]);
        }
        this._blobUrls = null;
    }
}

export { Bundle };
