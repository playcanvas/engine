/**
 * Represents the resource of a Bundle Asset, which contains an index that maps URLs to blob URLs.
 *
 * @ignore
 */
class Bundle {
    /**
     * index of asset file names to Blob
     * @type {Map<string, Blob>}
     * @private
     */
    _fileNameToBlob = new Map();

    /**
     * Create a new Bundle instance.
     *
     * @param {object[]} files - An array of objects that have a name field and contain a
     * getBlobUrl() function.
     */
    constructor(files) {
        for (let i = 0; i < files.length; i++) {
            if (!files[i].url) continue;
            this._fileNameToBlob.set(files[i].name, files[i].url);
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
        return this._fileNameToBlob.has(url);
    }

    /**
     * Returns a blob URL for the specified URL.
     *
     * @param {string} url - The original file URL. Make sure you have called decodeURIComponent on
     * the URL first.
     * @returns {Blob|null} A blob URL.
     */
    getBlobUrl(url) {
        return this._fileNameToBlob.get(url) || null;
    }

    /**
     * Destroys the bundle and frees up blob URLs.
     */
    destroy() {
        for (const url in this._fileNameToBlob.values()) {
            URL.revokeObjectURL(url);
        }
        this._fileNameToBlob.clear();
        this._fileNameToBlob = null;
    }
}

export { Bundle };
