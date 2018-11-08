Object.assign(pc, function () {
    'use strict';

    var Bundle = function (files) {
        this._blobUrls = {};
        for (var i = 0, len = files.length; i < len; i++) {
            this._blobUrls[files[i].name] = files[i].getBlobUrl();
        }
    };

    Bundle.prototype.hasUrl = function (url) {
        return !!this._blobUrls[url];
    };

    Bundle.prototype.getBlobUrl = function (url) {
        return this._blobUrls[url] || null;
    };

    return {
        Bundle: Bundle
    };
}());
