Object.assign(pc, function () {
    'use strict';

    /**
     * @private
     * @constructor
     * @name pc.Bundle
     * @param {Object[]} files An array of objects that have a name field and contain a getBlobUrl() function
     * @classdesc Represents the resource of a Bundle Asset, which contains an index that maps URLs to blob URLs.
     */
    var Bundle = function (files) {
        this._blobUrls = {};

        // index files by name
        this._files = {};
        for (var i = 0, len = files.length; i < len; i++) {
            this._files[files[i].name] = files[i];
        }
    };

    /**
     * @private
     * @function
     * @name pc.Bundle#getBlobUrl
     * @description Returns a blob URL for the specified URL.
     * @param {String} url The original file URL. Make sure you have called decodeURIComponent on the URL first.
     * @returns {String} A blob URL
     */
    Bundle.prototype.getBlobUrl = function (url) {
        var blobUrl = this._blobUrls[url];
        if (blobUrl) return blobUrl;

        if (! this._files[url]) return null;

        blobUrl = this._files[url].getBlobUrl();
        this._blobUrls[url] = blobUrl;

        return blobUrl;
    };


    /**
     * @private
     * @function
     * @name pc.Bundle#destroy
     * @description Destroys the bundle and frees up blob URLs
     */
    Bundle.prototype.destroy = function () {
        this._files = null;

        for (var key in this._blobUrls) {
            URL.revokeObjectURL(this._blobUrls[key]);
        }
        this._blobUrls = null;
    };

    return {
        Bundle: Bundle
    };
}());
