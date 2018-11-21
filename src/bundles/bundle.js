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

        for (var i = 0, len = files.length; i < len; i++) {
            if (files[i].url) {
                this._blobUrls[files[i].name] = files[i].url;
            }
        }
    };

    /**
     * @private
     * @function
     * @name pc.Bundle#hasBlobUrl
     * @description Returns true if the specified URL exists in the loaded bundle
     * @param {String} url The original file URL. Make sure you have called decodeURIComponent on the URL first.
     * @returns {Boolean} True of false
     */
    Bundle.prototype.hasBlobUrl = function (url) {
        return !!this._blobUrls[url];
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
        return this._blobUrls[url];
    };


    /**
     * @private
     * @function
     * @name pc.Bundle#destroy
     * @description Destroys the bundle and frees up blob URLs
     */
    Bundle.prototype.destroy = function () {
        for (var key in this._blobUrls) {
            URL.revokeObjectURL(this._blobUrls[key]);
        }
        this._blobUrls = null;
    };

    return {
        Bundle: Bundle
    };
}());
